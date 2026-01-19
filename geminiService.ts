
import { GoogleGenAI, Type } from "@google/genai";
import { RiderData } from "./types";

/**
 * Проверяет контент анкеты на наличие русского мата, оскорблений и неподобающего контента.
 */
export const validateContentSafety = async (data: RiderData): Promise<{ isSafe: boolean; reason?: string }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const textToCheck = `
    Имя: ${data.name}
    Локация: ${data.location}
    Техника: ${data.gears.filter(g => g.trim()).join(', ')}
    О себе: ${data.about || ''}
  `.trim();

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `ВНИМАТЕЛЬНО ПРОВЕРЬ ДАННЫЙ ТЕКСТ НА НАЛИЧИЕ РУССКОГО МАТА:
      "${textToCheck}"`,
      config: {
        systemInstruction: `Ты — строгий модератор русского мото-сообщества. Твоя задача: обнаруживать ЛЮБОЙ мат и оскорбления.
        ПРАВИЛА:
        1. Ищи прямой мат, производные формы (даже редкие), завуалированное написание (например: п.и.з.д.а, х@й, бл*ть, су4ка).
        2. Ищи оскорбления по любому признаку (национальность, ориентация, внешность).
        3. Если в тексте есть хоть малейший намек на нецензурную лексику — блокируй.
        4. Отвечай ТОЛЬКО в формате JSON: {"isSafe": boolean}. Никаких пояснений.`,
        responseMimeType: "application/json",
        // Отключаем автоматическую блокировку ответа, чтобы модель могла проанализировать мат и выдать нам false
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
        ],
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isSafe: { 
              type: Type.BOOLEAN,
              description: "true если текст безопасен, false если найден мат" 
            }
          },
          required: ["isSafe"]
        }
      }
    });

    // Если модель заблокировала результат (Safety block), значит контент крайне опасен
    if (!response.text) {
      console.warn("Gemini safety trigger: response is empty.");
      return { isSafe: false, reason: "Safety trigger" };
    }

    const result = JSON.parse(response.text.trim());
    return result;
  } catch (error) {
    console.error("Safety check error:", error);
    // В случае технического сбоя API разрешаем отправку, 
    // чтобы не блокировать нормальных пользователей.
    return { isSafe: true };
  }
};

export const generateRiderBio = async (data: RiderData): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const gearsStr = data.gears.filter(g => g.trim() !== '').join(', ') || 'Не указана';
  const prompt = `Составь крутое описание для профиля райдера на русском: Имя ${data.name}, Байк ${gearsStr}, Локация ${data.location}, Стаж ${data.season}. О себе: ${data.about || ''}. Стиль: дерзкий, молодежный, с эмодзи. До 200 символов.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text?.trim() || "Райдер готов к приключениям! 🤘";
  } catch (error) {
    return "Новый участник нашего сообщества! 🏁";
  }
};
