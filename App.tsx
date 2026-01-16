
import React, { useState, useRef, useEffect } from 'react';
import { RiderData, AppSettings, PhotoFile, SocialEntry } from './types';
import { generateRiderBio } from './geminiService';
import { sendToTelegram } from './telegramService';

// =========================================================
// ✅ КОНФИГУРАЦИЯ TELEGRAM
// =========================================================
const TELEGRAM_CONFIG: AppSettings = {
  botToken: '8394525518:AAF5RD0yvNLZQjiTS3wN61cC3K2HbNwJtxg', 
  chatId: '-1003610896779',      
  threadId: ''                
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
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (tg) {
      tg.ready();
      tg.expand();
      
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

      if (tg.themeParams?.bg_color) {
        document.body.style.backgroundColor = tg.themeParams.bg_color;
      }
    }
  }, [tg]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
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
    if (formData.socials.length <= 1) {
      handleSocialChange(0, 'handle', '');
      return;
    }
    const newSocials = formData.socials.filter((_, i) => i !== index);
    setFormData(prev => ({ ...prev, socials: newSocials }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (photos.length + files.length > 3) {
      tg?.showAlert("Максимум 3 фотографии");
      return;
    }

    const newPhotos: PhotoFile[] = files.map((file: File) => ({
      file,
      preview: URL.createObjectURL(file)
    }));

    setPhotos(prev => [...prev, ...newPhotos]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[index].preview);
      updated.splice(index, 1);
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!TELEGRAM_CONFIG.botToken || !TELEGRAM_CONFIG.chatId) {
      setStatus({ type: 'error', message: 'Ошибка конфигурации 🛠️' });
      return;
    }

    if (photos.length === 0) {
      setStatus({ type: 'error', message: 'Нужно хотя бы одно фото 📸' });
      return;
    }

    setIsSubmitting(true);
    setStatus({ type: null, message: '' });

    try {
      const aiBio = await generateRiderBio(formData);
      
      const result = await sendToTelegram(
        TELEGRAM_CONFIG, 
        formData, 
        aiBio, 
        photos.map(p => p.file)
      );

      if (result.ok || (Array.isArray(result) && result[0]?.ok)) {
        setStatus({ type: 'success', message: 'Отправлено! 🏁' });
        tg?.HapticFeedback?.notificationOccurred('success');
        setPhotos([]);
        setTimeout(() => {
           if (tg) tg.close();
        }, 1500);
      } else {
        throw new Error(result.description || 'Ошибка API Telegram');
      }
    } catch (error: any) {
      setStatus({ type: 'error', message: `Ошибка: ${error.message}` });
      tg?.HapticFeedback?.notificationOccurred('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col items-center justify-start relative overflow-x-hidden">
      {/* Background decoration */}
      <div className="absolute top-[-5%] left-[-10%] w-[60%] h-[40%] bg-green-900/10 blur-[100px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-[-5%] right-[-10%] w-[60%] h-[40%] bg-red-900/10 blur-[100px] rounded-full pointer-events-none"></div>

      {/* Header */}
      <div className="w-full max-w-lg mb-6 flex flex-col items-center relative z-10 pt-4">
        <div className="relative group mb-2">
          <div className="absolute -inset-4 bg-gradient-to-r from-red-600/10 to-green-600/10 rounded-full blur-xl opacity-50 group-hover:opacity-100 transition duration-1000"></div>
          <img 
            src="./logo.png" 
            alt="Zel Riders Logo" 
            className="relative w-32 h-32 md:w-48 md:h-48 object-contain drop-shadow-2xl"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              const textHeader = document.getElementById('text-header-fallback');
              if (textHeader) textHeader.style.display = 'block';
            }}
          />
        </div>
        <div id="text-header-fallback" style={{ display: 'none' }} className="text-center">
           <h1 className="text-4xl font-black italic tracking-tighter text-white uppercase mb-2">
            <span className="text-red-600">Z</span>el <span className="text-green-500">R</span>iders
          </h1>
        </div>
      </div>

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="w-full max-w-lg bg-[#181818]/80 backdrop-blur-md border border-neutral-800 rounded-[2rem] p-6 md:p-8 shadow-2xl relative z-10 mb-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="space-y-1.5">
            <label className="block text-[10px] font-black uppercase text-neutral-400 ml-1 tracking-wider">Имя *</label>
            <input 
              required
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3.5 text-white focus:border-neutral-500 outline-none"
              placeholder="Username"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-[10px] font-black uppercase text-neutral-400 ml-1 tracking-wider">Возраст</label>
            <input 
              name="age"
              type="number"
              value={formData.age}
              onChange={handleInputChange}
              className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3.5 text-white focus:border-neutral-500 outline-none"
              placeholder="25"
            />
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <label className="block text-[10px] font-black uppercase text-neutral-400 ml-1 tracking-wider">Локация *</label>
            <input 
              required
              name="location"
              value={formData.location}
              onChange={handleInputChange}
              className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3.5 text-white focus:border-neutral-500 outline-none"
              placeholder="Город / Район"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-[10px] font-black uppercase text-neutral-400 ml-1 tracking-wider">Байк *</label>
            <input 
              required
              name="gear"
              value={formData.gear}
              onChange={handleInputChange}
              className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3.5 text-white focus:border-neutral-500 outline-none"
              placeholder="Модель"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-[10px] font-black uppercase text-neutral-400 ml-1 tracking-wider">Стаж *</label>
            <input 
              required
              name="season"
              value={formData.season}
              onChange={handleInputChange}
              className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3.5 text-white focus:border-neutral-500 outline-none"
              placeholder="Сезонов"
            />
          </div>
          
          <div className="md:col-span-2 space-y-3 p-4 bg-neutral-900/40 rounded-2xl border border-neutral-800">
            <label className="block text-[10px] font-black uppercase text-neutral-400 ml-1 tracking-wider">Социальные сети</label>
            <div className="space-y-2">
              {formData.socials.map((social, index) => (
                <div key={index} className="flex gap-2">
                  <select 
                    value={social.platform}
                    onChange={(e) => handleSocialChange(index, 'platform', e.target.value)}
                    className="bg-neutral-800 border border-neutral-700 rounded-lg px-2 py-2.5 text-white text-xs font-bold"
                  >
                    <option value="Telegram">Telegram</option>
                    <option value="Instagram">Instagram</option>
                    <option value="VK">VK</option>
                  </select>
                  <input 
                    value={social.handle}
                    onChange={(e) => handleSocialChange(index, 'handle', e.target.value)}
                    className="flex-grow bg-neutral-900/50 border border-neutral-700 rounded-lg px-4 py-2.5 text-white outline-none text-sm"
                    placeholder="@handle"
                  />
                  {formData.socials.length > 1 && (
                    <button type="button" onClick={() => removeSocialEntry(index)} className="text-red-500 px-2 transition-transform active:scale-90">
                      <i className="fas fa-trash"></i>
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button 
              type="button" 
              onClick={addSocialEntry}
              className="text-[9px] font-black uppercase text-neutral-500 hover:text-white transition-colors"
            >
              + Добавить еще
            </button>
          </div>
        </div>

        <div className="mb-8">
          <label className="block text-[10px] font-black uppercase text-neutral-400 mb-3 ml-1 tracking-widest">Фото (из галереи) *</label>
          <div className="flex flex-wrap gap-3">
            {photos.map((photo, idx) => (
              <div key={idx} className="relative w-24 h-24 rounded-xl overflow-hidden bg-neutral-900 border border-neutral-800 shadow-lg">
                <img src={photo.preview} className="w-full h-full object-cover" />
                <button type="button" onClick={() => removePhoto(idx)} className="absolute top-0 right-0 bg-red-600 text-white w-6 h-6 flex items-center justify-center rounded-bl-xl shadow-md">
                  <i className="fas fa-times text-[10px]"></i>
                </button>
              </div>
            ))}
            {photos.length < 3 && (
              <button 
                type="button" 
                onClick={() => fileInputRef.current?.click()}
                className="w-24 h-24 rounded-xl border border-dashed border-neutral-700 flex flex-col items-center justify-center text-neutral-500 hover:text-neutral-300 hover:border-neutral-500 transition-all bg-neutral-900/30"
              >
                <i className="fas fa-images text-2xl mb-1"></i>
                <span className="text-[8px] font-black uppercase">Gallery</span>
              </button>
            )}
          </div>
          <input type="file" multiple accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
        </div>

        {status.message && (
          <div className={`mb-6 p-4 rounded-xl text-[10px] font-black uppercase text-center animate-pulse ${status.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
            {status.message}
          </div>
        )}

        <button 
          disabled={isSubmitting}
          style={{ background: 'linear-gradient(to right, #ef4444 0%, #ffffff 50%, #22c55e 100%)' }}
          className="w-full py-7 text-2xl text-black font-black uppercase tracking-widest rounded-[1.5rem] shadow-[0_10px_40px_rgba(0,0,0,0.4)] active:scale-[0.97] transition-all disabled:opacity-50 relative overflow-hidden group"
        >
          <span className="relative z-10">{isSubmitting ? 'Отправка...' : 'Отправить в чат'}</span>
          <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
        </button>
      </form>

      <footer className="mb-10 text-neutral-600 text-[10px] uppercase font-black tracking-[0.4em] flex items-center gap-4">
        <span className="w-8 h-[1px] bg-neutral-800"></span>
        Zel Riders Community
        <span className="w-8 h-[1px] bg-neutral-800"></span>
      </footer>
    </div>
  );
};

export default App;
