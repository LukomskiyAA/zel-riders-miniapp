
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { RiderData, AppSettings, PhotoFile, SocialEntry } from './types';
import { generateRiderBio } from './geminiService';
import { sendToTelegram } from './telegramService';

// =========================================================
// ✅ КОНФИГУРАЦИЯ ЗАКРЫТОГО КЛУБА
// =========================================================
const CLUB_CONFIG: AppSettings & { chatInviteLink: string } = {
  botToken: '8394525518:AAF5RD0yvNLZQjiTS3wN61cC3K2HbNwJtxg', 
  chatId: '-1003610896779',      
  // ID темы из ссылки -1003610896779_2 это число 2
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
        tg?.showAlert("Для вступления в клуб нужно заполнить все поля со звездочкой (*)");
        return;
    }

    if (photos.length === 0) {
      tg?.showAlert("Загрузи хотя бы одно фото своего байка или себя!");
      return;
    }

    setIsSubmitting(true);
    tg?.MainButton?.showProgress();

    try {
      const aiBio = await generateRiderBio(formData);
      
      const result = await sendToTelegram(
        CLUB_CONFIG, 
        formData, 
        aiBio, 
        photos.map(p => p.file)
      );

      if (result.ok || (Array.isArray(result) && result[0]?.ok)) {
        setIsSuccess(true);
        tg?.HapticFeedback?.notificationOccurred('success');
        tg?.MainButton?.hide();
      } else {
        throw new Error(result.description || 'Ошибка при верификации');
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
      tg.MainButton.setText('ПОЛУЧИТЬ ДОСТУП');
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
          
          <h2 className="text-2xl font-black text-white uppercase italic leading-tight mb-2">Доступ разрешен</h2>
          <p className="text-[10px] text-neutral-500 uppercase tracking-[0.2em] mb-8">Zel Riders Verification Passed</p>
          
          <div className="space-y-4">
            <a 
              href={CLUB_CONFIG.chatInviteLink}
              className="block w-full py-5 bg-white text-black font-black uppercase tracking-widest rounded-xl hover:scale-[1.02] active:scale-95 transition-all shadow-xl"
            >
              Вступить в чат
            </a>
            <p className="text-[9px] text-neutral-600 font-medium">Твоя анкета уже в базе сообщества. Увидимся на дорогах!</p>
          </div>
        </div>
        
        <button onClick={() => tg?.close()} className="mt-12 text-neutral-700 text-[10px] font-black uppercase tracking-widest border-b border-neutral-900 pb-1">
          Вернуться в Telegram
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 flex flex-col items-center justify-start relative bg-[#0a0a0a] pb-24">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-red-600/5 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-green-600/5 blur-[120px] rounded-full"></div>
      </div>

      <header className="w-full max-w-lg mb-8 flex flex-col items-center pt-8 z-10">
        <img src="./logo.png" alt="Zel Riders" className="w-32 h-32 object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.1)] mb-4" />
        <h1 className="text-white text-xl font-black uppercase italic tracking-tighter">Zel Riders <span className="text-red-600">Gate</span></h1>
        <div className="h-0.5 w-12 bg-red-600 mt-2"></div>
        <p className="text-neutral-500 text-[9px] font-black uppercase tracking-[0.4em] mt-4 opacity-50 text-center">Пройди верификацию для доступа в чат</p>
      </header>

      <main className="w-full max-w-lg bg-[#111] border border-neutral-900 rounded-[2.5rem] p-6 md:p-8 shadow-2xl z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-neutral-500 uppercase ml-1">Имя в тусовке *</label>
            <input name="name" value={formData.name} onChange={handleInputChange} className="w-full bg-black border border-neutral-800 rounded-2xl px-5 py-4 text-white focus:border-red-600 outline-none transition-all" placeholder="Nickname" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-neutral-500 uppercase ml-1">Возраст</label>
            <input name="age" type="number" value={formData.age} onChange={handleInputChange} className="w-full bg-black border border-neutral-800 rounded-2xl px-5 py-4 text-white focus:border-red-600 outline-none transition-all" placeholder="25" />
          </div>
          <div className="md:col-span-2 space-y-2">
            <label className="text-[10px] font-black text-neutral-500 uppercase ml-1">Откуда ты? *</label>
            <input name="location" value={formData.location} onChange={handleInputChange} className="w-full bg-black border border-neutral-800 rounded-2xl px-5 py-4 text-white focus:border-red-600 outline-none transition-all" placeholder="Зеленоград / Москва" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-neutral-500 uppercase ml-1">Твой байк *</label>
            <input name="gear" value={formData.gear} onChange={handleInputChange} className="w-full bg-black border border-neutral-800 rounded-2xl px-5 py-4 text-white focus:border-red-600 outline-none transition-all" placeholder="Модель" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-neutral-500 uppercase ml-1">Опыт (сезоны) *</label>
            <input name="season" value={formData.season} onChange={handleInputChange} className="w-full bg-black border border-neutral-800 rounded-2xl px-5 py-4 text-white focus:border-red-600 outline-none transition-all" placeholder="3" />
          </div>

          <div className="md:col-span-2 p-5 bg-black rounded-3xl border border-neutral-900 space-y-4">
             <label className="text-[10px] font-black text-neutral-500 uppercase block">Контакты</label>
             {formData.socials.map((social, idx) => (
               <div key={idx} className="flex gap-2">
                 <select value={social.platform} onChange={(e) => handleSocialChange(idx, 'platform', e.target.value)} className="bg-neutral-900 border border-neutral-800 rounded-xl px-3 text-xs text-white">
                   <option>Telegram</option>
                   <option>Instagram</option>
                 </select>
                 <input value={social.handle} onChange={(e) => handleSocialChange(idx, 'handle', e.target.value)} className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-sm text-white focus:border-red-600 outline-none" placeholder="@handle" />
                 {formData.socials.length > 1 && (
                   <button onClick={() => removeSocialEntry(idx)} className="text-neutral-700 hover:text-red-500 px-1"><i className="fas fa-times"></i></button>
                 )}
               </div>
             ))}
             <button onClick={addSocialEntry} className="text-[9px] font-black uppercase text-red-600 hover:text-white transition-all">+ Еще контакт</button>
          </div>
        </div>

        <div className="space-y-4">
          <label className="text-[10px] font-black text-neutral-500 uppercase ml-1 block">Добавь фото (байк/ты) *</label>
          <div className="flex flex-wrap gap-4">
            {photos.map((p, idx) => (
              <div key={idx} className="relative w-24 h-24 rounded-2xl overflow-hidden border border-neutral-800 group">
                <img src={p.preview} className="w-full h-full object-cover" alt="Preview" />
                <button onClick={() => removePhoto(idx)} className="absolute inset-0 bg-red-600/80 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <i className="fas fa-trash"></i>
                </button>
              </div>
            ))}
            {photos.length < 3 && (
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="w-24 h-24 rounded-2xl border-2 border-dashed border-neutral-900 flex flex-col items-center justify-center text-neutral-700 hover:text-red-600 hover:border-red-600 transition-all"
              >
                <i className="fas fa-camera text-xl mb-1"></i>
                <span className="text-[8px] font-black">ADD</span>
              </button>
            )}
          </div>
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple onChange={handleFileChange} />
        </div>

        {status.message && (
          <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 text-[10px] font-bold uppercase text-center">
            {status.message}
          </div>
        )}
      </main>

      <footer className="mt-12 text-neutral-800 text-[10px] font-black uppercase tracking-[0.6em] text-center">
        Secure Verification Protocol v2
      </footer>
    </div>
  );
};

export default App;
