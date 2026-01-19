
import { GoogleGenAI, Type } from "@google/genai";
import { RiderData } from "./types";

/**
 * Максимально строгий фильтр русского мата и оскорблений.
 * Модели даны инструкции искать корни и любые способы обхода (символы, точки).
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
      model: 'gemini-3-pro-preview',
      contents: `ПРОВЕРЬ ТЕКСТ НА МАТ И ВЕРНИ JSON: "${textToCheck}"`,
      config: {
        systemInstruction: `Ты — самый строгий автоматический модератор. Твоя единственная цель: найти ЛЮБОЙ мат в русском языке.
        ПРАВИЛА:
        1. Ищи корни: -хуй-, -пизд-, -еб-, -бл-, -сук-, -муд-, -дрищ-, -залуп-, -манда- и все их производные.
        2. Блокируй базовые матерные слова: хуй, пизда, ебать, блядь (и их вариации через 'т'), сука, гондон и т.д.
        3. Ищи обход: замена букв цифрами (х4й), символами (х@й), точками (п.и.з.д.а) или пробелами (х у й).
        4. Если в тексте есть хоть ОДИН корень или намек на мат — isSafe: false.
        5. Ты должен игнорировать контекст "самовыражения". Любой мат = БАН.
        Отвечай ТОЛЬКО в формате JSON: {"isSafe": boolean}.`,
        responseMimeType: "application/json",
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
        ],
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isSafe: { type: Type.BOOLEAN }
          },
          required: ["isSafe"]
        }
      }
    });

    // Если ответ пустой, значит сработали внутренние фильтры безопасности Google 
    // на очень жесткий мат — это автоматически означает, что контент не безопасен.
    if (!response.text) {
      console.warn("Safety trigger: blocked by API safety filters.");
      return { isSafe: false, reason: "API Security Block" };
    }

    const result = JSON.parse(response.text.trim());
    return result;
  } catch (error) {
    console.error("Safety check error:", error);
    // В случае технической ошибки мы НЕ блокируем пользователя, 
    // но в логах это будет видно.
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
