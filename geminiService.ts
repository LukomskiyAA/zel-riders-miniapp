
import { GoogleGenAI } from "@google/genai";
import { RiderData } from "./types";

export const generateRiderBio = async (data: RiderData): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const validSocials = data.socials.filter(s => s.handle.trim() !== '');
  const socialStr = validSocials.length > 0 
    ? validSocials.map(s => `${s.platform}: ${s.handle}`).join(', ') 
    : 'Не указано';

  const prompt = `
    У нас есть новый райдер. Составь крутое, короткое и вдохновляющее описание для его профиля в Телеграм-канале на основе этих данных:
    Имя: ${data.name}
    Возраст: ${data.age || 'Не указан'}
    Локация: ${data.location}
    Техника: ${data.gear}
    Сезон опыта: ${data.season}
    Соц. сети: ${socialStr}
    
    Стиль: Спортивный, молодежный, дерзкий. Используй эмодзи. Не более 200 символов.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "Райдер готов к приключениям! 🤘";
  } catch (error) {
    console.error("Gemini AI error:", error);
    return "Новый участник нашего сообщества! 🏁";
  }
};
