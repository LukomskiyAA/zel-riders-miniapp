
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { RiderData, AppSettings, PhotoFile, SocialEntry } from './types';
import { sendToTelegram } from './telegramService';

const CLUB_CONFIG: AppSettings & { chatInviteLink: string } = {
  botToken: '8394525518:AAF5RD0yvNLZQjiTS3wN61cC3K2HbNwJtxg', 
  chatId: '-1003610896779',      
  threadId: '2', 
  chatInviteLink: 'https://t.me/+52X67-4oxYJmM2E6' 
};

declare global {
  interface Window {
    Telegram: any;
  }
}

const App: React.FC = () => {
  const tg = window.Telegram?.WebApp;

  const [formData, setFormData] = useState<RiderData>({
    name: '',
    age: '',
    location: '',
    gear: '',
    season: '',
    socials: [{ platform: 'Telegram', handle: '' }]
  });

  const [photos, setPhotos] = useState<PhotoFile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const performSubmit = useCallback(async () => {
    if (isSubmitting || isSuccess) return;
    
    if (!formData.name || !formData.location || !formData.gear || !formData.season) {
        tg?.showAlert("Для вступления заполни все обязательные поля (*)");
        return;
    }

    if (photos.length === 0) {
      tg?.showAlert("Добавь хотя бы одно фото!");
      return;
    }

    setIsSubmitting(true);
    tg?.MainButton?.showProgress();

    try {
      const result = await sendToTelegram(
        CLUB_CONFIG, 
        formData, 
        photos.map(p => p.file)
      );

      if (result.ok || (Array.isArray(result) && result[0]?.ok)) {
        setIsSuccess(true);
        tg?.HapticFeedback?.notificationOccurred('success');
        tg?.MainButton?.hide();
      } else {
        throw new Error(result.description || 'Ошибка API');
      }
    } catch (error: any) {
      setStatus({ type: 'error', message: `Ошибка: ${error.message}` });
      tg?.HapticFeedback?.notificationOccurred('error');
      tg?.MainButton?.hideProgress();
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, photos, isSubmitting, isSuccess, tg]);

  useEffect(() => {
    if (tg && !isSuccess) {
      tg.MainButton.setText('ОТПРАВИТЬ АНКЕТУ');
      tg.MainButton.setParams({
        is_visible: true,
        is_active: !isSubmitting && formData.name.length > 0,
        color: '#ef4444',
        text_color: '#ffffff'
      });
      tg.MainButton.onClick(performSubmit);
      return () => tg.MainButton.offClick(performSubmit);
    }
  }, [tg, performSubmit, formData.name, isSubmitting, isSuccess]);

  useEffect(() => {
    if (tg) {
      tg.ready();
      tg.expand();
      tg.setHeaderColor('#0a0a0a');
      tg.setBackgroundColor('#0a0a0a');
      
      const user = tg.initDataUnsafe?.user;
      if (user) {
        setFormData(prev => ({
          ...prev,
          name: prev.name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username || '',
          tgUserId: user.id,
          tgUsername: user.username,
          socials: prev.socials.map((s, i) => 
            i === 0 && s.platform === 'Telegram' && !s.handle 
              ? { ...s, handle: user.username ? `@${user.username}` : '' } 
              : s
          )
        }));
      }
    }
  }, [tg]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSocialChange = (index: number, field: keyof SocialEntry, value: string) => {
    const newSocials = [...formData.socials];
    newSocials[index] = { ...newSocials[index], [field]: value };
    setFormData(prev => ({ ...prev, socials: newSocials }));
  };

  const addSocialEntry = () => {
    setFormData(prev => ({
      ...prev,
      socials: [...prev.socials, { platform: 'Instagram', handle: '' }]
    }));
  };

  const removeSocialEntry = (index: number) => {
    if (formData.socials.length <= 1) return;
    setFormData(prev => ({ ...prev, socials: prev.socials.filter((_, i) => i !== index) }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (photos.length + files.length > 3) {
      tg?.showAlert("Максимум 3 фото");
      return;
    }
    const newPhotos = files.map(file => ({ file, preview: URL.createObjectURL(file) }));
    setPhotos(prev => [...prev, ...newPhotos]);
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen p-6 flex flex-col items-center justify-center text-center bg-[#0a0a0a]">
        <div className="w-full max-w-xs p-8 bg-[#181818] rounded-[2.5rem] border-2 border-green-500 shadow-[0_0_50px_rgba(34,197,94,0.2)] animate-in zoom-in duration-500 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-green-500 to-transparent animate-pulse"></div>
          <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <i className="fas fa-check text-4xl text-green-500"></i>
          </div>
          <h2 className="text-2xl font-black text-white uppercase italic leading-tight mb-2">Анкета принята</h2>
          <p className="text-[10px] text-neutral-500 uppercase tracking-[0.2em] mb-8">ZEL RIDERS Verification Passed</p>
          <div className="space-y-4">
            <a href={CLUB_CONFIG.chatInviteLink} className="block w-full py-5 bg-white text-black font-black uppercase tracking-widest rounded-xl hover:scale-[1.02] active:scale-95 transition-all shadow-xl">
              Вступить в чат
            </a>
            <p className="text-[9px] text-neutral-600 font-medium italic">Анкетка уже в топике. Газуем!</p>
          </div>
        </div>
        <button onClick={() => tg?.close()} className="mt-12 text-neutral-700 text-[10px] font-black uppercase tracking-widest border-b border-neutral-900 pb-1">
          Закрыть
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 flex flex-col items-center justify-start relative bg-[#0a0a0a] pb-24">
      <header className="w-full max-w-lg mb-8 flex flex-col items-center pt-8 z-20">
        <h1 className="text-4xl font-black uppercase italic tracking-tighter">
          <span className="text-red-600">Z</span><span className="text-white">EL</span>
          <span className="inline-block w-3"></span>
          <span className="text-green-600">R</span><span className="text-white">IDERS</span>
        </h1>
        <p className="text-neutral-500 text-[11px] font-black uppercase tracking-[0.25em] mt-4 opacity-90 text-center px-4">
          Заявка на вступление в чат
        </p>
      </header>

      <main className="w-full max-w-lg bg-[#111]/80 backdrop-blur-2xl border border-neutral-900 rounded-[2.5rem] p-6 md:p-8 shadow-2xl z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-neutral-500 uppercase ml-1">Имя / Ник *</label>
            <input name="name" value={formData.name} onChange={handleInputChange} className="w-full bg-black border border-neutral-800 rounded-2xl px-5 py-4 text-white focus:border-red-600 outline-none transition-all placeholder:opacity-20" placeholder="Rider Name" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-neutral-500 uppercase ml-1">Возраст</label>
            <input name="age" type="number" value={formData.age} onChange={handleInputChange} className="w-full bg-black border border-neutral-800 rounded-2xl px-5 py-4 text-white focus:border-red-600 outline-none transition-all placeholder:opacity-20" placeholder="25" />
          </div>
          <div className="md:col-span-2 space-y-2">
            <label className="text-[10px] font-black text-neutral-500 uppercase ml-1">Город / Район *</label>
            <input name="location" value={formData.location} onChange={handleInputChange} className="w-full bg-black border border-neutral-800 rounded-2xl px-5 py-4 text-white focus:border-red-600 outline-none transition-all placeholder:opacity-20" placeholder="Зеленоград / Москва" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-neutral-500 uppercase ml-1">Твой байк *</label>
            <input name="gear" value={formData.gear} onChange={handleInputChange} className="w-full bg-black border border-neutral-800 rounded-2xl px-5 py-4 text-white focus:border-red-600 outline-none transition-all placeholder:opacity-20" placeholder="Yamaha R1 / Honda..." />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-neutral-500 uppercase ml-1">Стаж (сезонов) *</label>
            <input name="season" value={formData.season} onChange={handleInputChange} className="w-full bg-black border border-neutral-800 rounded-2xl px-5 py-4 text-white focus:border-red-600 outline-none transition-all placeholder:opacity-20" placeholder="3" />
          </div>

          <div className="md:col-span-2 p-5 bg-black rounded-3xl border border-neutral-900 space-y-4">
             <label className="text-[10px] font-black text-neutral-500 uppercase block">Контакты (соцсети)</label>
             {formData.socials.map((social, idx) => (
               <div key={idx} className="flex gap-2">
                 <select value={social.platform} onChange={(e) => handleSocialChange(idx, 'platform', e.target.value)} className="bg-neutral-900 border border-neutral-800 rounded-xl px-3 text-xs text-white">
                   <option>Telegram</option>
                   <option>Instagram</option>
                   <option>VK</option>
                 </select>
                 <input value={social.handle} onChange={(e) => handleSocialChange(idx, 'handle', e.target.value)} className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-sm text-white focus:border-red-600 outline-none transition-all" placeholder="@handle" />
                 {formData.socials.length > 1 && (
                   <button onClick={() => removeSocialEntry(idx)} className="text-neutral-700 hover:text-red-500 px-1 transition-colors">
                     <i className="fas fa-times"></i>
                   </button>
                 )}
               </div>
             ))}
             <button onClick={addSocialEntry} className="text-[9px] font-black uppercase text-red-600 hover:text-white transition-all flex items-center gap-2">
               <span className="text-lg">+</span> Добавить контакт
             </button>
          </div>
        </div>

        <div className="space-y-4">
          <label className="text-[10px] font-black text-neutral-500 uppercase ml-1 block">Фото (до 3 шт) *</label>
          <div className="flex flex-wrap gap-4">
            {photos.map((p, idx) => (
              <div key={idx} className="relative w-24 h-24 rounded-2xl overflow-hidden border border-neutral-800 shadow-lg">
                <img src={p.preview} className="w-full h-full object-cover" alt="Preview" />
                <button onClick={() => removePhoto(idx)} className="absolute top-1 right-1 bg-red-600 w-6 h-6 rounded-full text-white text-[10px] flex items-center justify-center">
                  <i className="fas fa-times"></i>
                </button>
              </div>
            ))}
            {photos.length < 3 && (
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="w-24 h-24 rounded-2xl border-2 border-dashed border-neutral-900 flex flex-col items-center justify-center text-neutral-700 hover:text-green-600 hover:border-green-600 transition-all bg-black/40"
              >
                <i className="fas fa-camera text-xl mb-1"></i>
                <span className="text-[8px] font-black uppercase tracking-tighter">Загрузить</span>
              </button>
            )}
          </div>
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple onChange={handleFileChange} />
        </div>
      </main>

      <footer className="mt-12 text-neutral-800 text-[10px] font-black uppercase tracking-[0.6em] text-center max-w-xs leading-relaxed">
        ZEL RIDERS Community
      </footer>
    </div>
  );
};

export default App;
