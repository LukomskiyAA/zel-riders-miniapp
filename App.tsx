
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { RiderData, AppSettings, PhotoFile, SocialEntry } from './types';
import { sendToTelegram, checkChatMembership, deleteMessages } from './telegramService';

const CLUB_CONFIG: AppSettings & { chatInviteLink: string } = {
  botToken: '8394525518:AAF5RD0yvNLZQjiTS3wN61cC3K2HbNwJtxg', 
  chatId: '-1003610896779',      
  threadId: '2', 
  chatInviteLink: 'https://t.me/+52X67-4oxYJmM2E6' 
};

const STORAGE_KEY = 'last_profile_msg_ids';

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
    gears: [''],
    season: '',
    socials: [{ platform: 'Telegram', handle: '' }],
    about: ''
  });

  const [photos, setPhotos] = useState<PhotoFile[]>([]);
  const [isLoadingMembership, setIsLoadingMembership] = useState(true);
  const [isAlreadyMember, setIsAlreadyMember] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [lastMessageIds, setLastMessageIds] = useState<number[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Инициализация и проверка
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
          tgUserId: user.id,
          tgUsername: user.username,
          socials: prev.socials.map((s, i) => 
            i === 0 && s.platform === 'Telegram' && !s.handle 
              ? { ...s, handle: user.username ? `@${user.username}` : '' } 
              : s
          )
        }));

        // Получаем ID старых сообщений из облака
        tg.CloudStorage.getItem(STORAGE_KEY, (err: any, value: string) => {
          if (!err && value) {
            try {
              setLastMessageIds(JSON.parse(value));
            } catch (e) { console.error(e); }
          }
        });

        // Проверка членства
        checkChatMembership(CLUB_CONFIG, user.id).then(isMember => {
          setIsAlreadyMember(isMember);
          setIsLoadingMembership(false);
        }).catch(() => setIsLoadingMembership(false));
      } else {
        setIsLoadingMembership(false);
      }
    }
  }, [tg]);

  const performSubmit = useCallback(async () => {
    if (isSubmitting || isSuccess) return;
    
    const hasGear = formData.gears.some(g => g.trim().length > 0);
    if (!formData.name.trim() || !formData.location.trim() || !hasGear || !formData.season.trim()) {
        tg?.showAlert("Заполни все обязательные поля со звездочкой (*)");
        return;
    }

    if (photos.length === 0) {
      tg?.showAlert("Добавь хотя бы одно фото!");
      return;
    }

    setIsSubmitting(true);
    tg?.MainButton?.showProgress();

    try {
      // 1. Удаляем старую анкету, если её ID сохранены
      if (lastMessageIds.length > 0) {
        await deleteMessages(CLUB_CONFIG, lastMessageIds);
      }

      // 2. Отправляем новую анкету
      const result = await sendToTelegram(CLUB_CONFIG, formData, photos.map(p => p.file));

      if (result.ok) {
        // 3. Сохраняем новые ID в облако для следующего раза
        tg.CloudStorage.setItem(STORAGE_KEY, JSON.stringify(result.messageIds));
        
        setIsSuccess(true);
        tg?.HapticFeedback?.notificationOccurred('success');
        tg?.MainButton?.hide();
      } else {
        throw new Error(result.description || 'Ошибка API');
      }
    } catch (error: any) {
      tg?.showAlert(`Ошибка: ${error.message}`);
      tg?.HapticFeedback?.notificationOccurred('error');
      tg?.MainButton?.hideProgress();
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, photos, isSubmitting, isSuccess, tg, lastMessageIds]);

  useEffect(() => {
    if (tg && !isSuccess && !isAlreadyMember && !isLoadingMembership) {
      tg.MainButton.setText('ОТПРАВИТЬ АНКЕТУ');
      tg.MainButton.setParams({
        is_visible: true,
        is_active: !isSubmitting && formData.name.trim().length > 0,
        color: '#ef4444',
        text_color: '#ffffff'
      });
      tg.MainButton.onClick(performSubmit);
      return () => tg.MainButton.offClick(performSubmit);
    } else {
      tg?.MainButton?.hide();
    }
  }, [tg, performSubmit, formData.name, isSubmitting, isSuccess, isAlreadyMember, isLoadingMembership]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleNumericInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const numericValue = value.replace(/\D/g, '');
    setFormData(prev => ({ ...prev, [name]: numericValue }));
  };

  const handleGearChange = (index: number, value: string) => {
    const newGears = [...formData.gears];
    newGears[index] = value;
    setFormData(prev => ({ ...prev, gears: newGears }));
  };

  const addGear = () => setFormData(prev => ({ ...prev, gears: [...prev.gears, ''] }));
  const removeGear = (index: number) => {
    if (formData.gears.length <= 1) return;
    setFormData(prev => ({ ...prev, gears: prev.gears.filter((_, i) => i !== index) }));
  };

  const handleSocialChange = (index: number, field: keyof SocialEntry, value: string) => {
    const newSocials = [...formData.socials];
    newSocials[index] = { ...newSocials[index], [field]: value };
    setFormData(prev => ({ ...prev, socials: newSocials }));
  };

  const addSocialEntry = () => setFormData(prev => ({
    ...prev,
    socials: [...prev.socials, { platform: 'Instagram', handle: '' }]
  }));

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

  if (isLoadingMembership) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-neutral-500 text-[10px] font-black uppercase tracking-[0.3em]">Проверка доступа...</p>
        </div>
      </div>
    );
  }

  if (isSuccess || isAlreadyMember) {
    const title = isAlreadyMember ? "С возвращением!" : "Готово";
    const subTitle = isAlreadyMember ? "Ты уже в банде Zel Riders" : "Анкета отправлена";
    const buttonText = isAlreadyMember ? "Перейти в чат" : "Вступить в чат";

    return (
      <div className="min-h-screen p-6 flex flex-col items-center justify-center text-center bg-[#0a0a0a]">
        <div className="w-full max-w-xs p-8 bg-[#181818] rounded-[2.5rem] border-2 border-green-500 shadow-[0_0_50px_rgba(34,197,94,0.2)]">
          <h2 className="text-2xl font-black text-white uppercase italic leading-tight mb-2">{title}</h2>
          <p className="text-[10px] text-neutral-500 uppercase tracking-[0.2em] mb-8">{subTitle}</p>
          <div className="space-y-4">
            <a href={CLUB_CONFIG.chatInviteLink} className="block w-full py-5 bg-white text-black font-black uppercase tracking-widest rounded-xl shadow-lg transform active:scale-95 transition-all">
              {buttonText}
            </a>
          </div>
        </div>
        {isAlreadyMember && (
          <p className="mt-8 text-neutral-700 text-[9px] font-black uppercase tracking-widest italic">
            Рады тебя видеть снова!
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 flex flex-col items-center justify-start relative bg-[#0a0a0a] pb-24 animate-in fade-in duration-700">
      <header className="w-full max-w-lg mb-8 flex flex-col items-center pt-8 z-20">
        <h1 className="text-4xl font-black uppercase italic tracking-tighter">
          <span className="text-red-600">Z</span><span className="text-white">EL</span>
          <span className="inline-block w-3"></span>
          <span className="text-green-600">R</span><span className="text-white">IDERS</span>
        </h1>
        <p className="text-neutral-500 text-[11px] font-black uppercase tracking-[0.25em] mt-4 opacity-90 text-center px-4">
          Заявка на вступление
        </p>
      </header>

      <main className="w-full max-w-lg bg-[#111]/80 backdrop-blur-2xl border border-neutral-900 rounded-[2.5rem] p-6 md:p-8 shadow-2xl z-10">
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-neutral-500 uppercase ml-1">Имя *</label>
            <input name="name" value={formData.name} onChange={handleInputChange} className="w-full bg-black border border-neutral-800 rounded-2xl px-5 py-4 text-white focus:border-red-600 outline-none transition-all" placeholder="Твоё имя" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-neutral-500 uppercase ml-1">Возраст</label>
              <input name="age" type="text" inputMode="numeric" value={formData.age} onChange={handleNumericInput} className="w-full bg-black border border-neutral-800 rounded-2xl px-5 py-4 text-white focus:border-red-600 outline-none transition-all" placeholder="25" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-neutral-500 uppercase ml-1">Стаж (сезонов) *</label>
              <input name="season" type="text" inputMode="numeric" value={formData.season} onChange={handleNumericInput} className="w-full bg-black border border-neutral-800 rounded-2xl px-5 py-4 text-white focus:border-red-600 outline-none transition-all" placeholder="3" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-neutral-500 uppercase ml-1">Город / Район *</label>
            <input name="location" value={formData.location} onChange={handleInputChange} className="w-full bg-black border border-neutral-800 rounded-2xl px-5 py-4 text-white focus:border-red-600 outline-none transition-all" placeholder="Зеленоград / Москва" />
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black text-neutral-500 uppercase ml-1 block">Техника *</label>
            {formData.gears.map((gear, idx) => (
              <div key={idx} className="flex gap-2">
                <input value={gear} onChange={(e) => handleGearChange(idx, e.target.value)} className="flex-1 bg-black border border-neutral-800 rounded-2xl px-5 py-4 text-white focus:border-red-600 outline-none transition-all" placeholder={`Байк #${idx + 1}`} />
                {formData.gears.length > 1 && (
                  <button onClick={() => removeGear(idx)} className="bg-neutral-900 border border-neutral-800 rounded-2xl px-4 text-neutral-500 hover:text-red-500 transition-colors">
                    <i className="fas fa-times"></i>
                  </button>
                )}
              </div>
            ))}
            <button onClick={addGear} className="text-[9px] font-black uppercase text-green-600 hover:text-white transition-all flex items-center gap-2 px-1">
              <span className="text-lg">+</span> Добавить еще байк
            </button>
          </div>

          <div className="p-5 bg-black rounded-3xl border border-neutral-900 space-y-4">
             <label className="text-[10px] font-black text-neutral-500 uppercase block">Контакты (соцсети)</label>
             {formData.socials.map((social, idx) => (
               <div key={idx} className="flex gap-2">
                 <select value={social.platform} onChange={(e) => handleSocialChange(idx, 'platform', e.target.value)} className="bg-neutral-900 border border-neutral-800 rounded-xl px-3 text-xs text-white">
                   <option>Telegram</option>
                   <option>Instagram</option>
                   <option>VK</option>
                 </select>
                 <input value={social.handle} onChange={(e) => handleSocialChange(idx, 'handle', e.target.value)} className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-sm text-white focus:border-red-600 outline-none transition-all" placeholder="Никнейм" />
                 {formData.socials.length > 1 && (
                   <button onClick={() => removeSocialEntry(idx)} className="text-neutral-700 hover:text-red-500 px-1">
                     <i className="fas fa-times"></i>
                   </button>
                 )}
               </div>
             ))}
             <button onClick={addSocialEntry} className="text-[9px] font-black uppercase text-red-600 hover:text-white transition-all flex items-center gap-2">
               <span className="text-lg">+</span> Еще контакт
             </button>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-neutral-500 uppercase ml-1">О себе</label>
            <textarea name="about" value={formData.about} onChange={handleInputChange} className="w-full bg-black border border-neutral-800 rounded-2xl px-5 py-4 text-white focus:border-red-600 outline-none transition-all min-h-[100px]" placeholder="Расскажи что-нибудь интересное..." />
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
        </div>
      </main>

      <footer className="mt-12 text-neutral-800 text-[10px] font-black uppercase tracking-[0.6em] text-center max-w-xs leading-relaxed">
        ZEL RIDERS Community
      </footer>
    </div>
  );
};

export default App;
