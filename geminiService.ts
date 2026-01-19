import { GoogleGenAI, Type } from "@google/genai";
import { RiderData } from "./types";

// Список запрещенных корней для мгновенной локальной проверки
const FORBIDDEN_ROOTS = [
  'хуй', 'хуе', 'хуи', 'хуя',
  'пизд',
  'еба', 'еби', 'ебл', 'ебу', 'ёб',
  'бля',
  'сука', 'суч',
  'муд',
  'гондон', 'гандон',
  'залуп',
  'манда',
  'дроч'
];

/**
 * Локальная проверка на мат (быстрая).
 */
const localProfanityCheck = (text: string): boolean => {
  const lowerText = text.toLowerCase();
  // Убираем лишние символы для проверки "скрытого" мата (п.и.з.д.а -> пизда)
  const cleanText = lowerText.replace(/[^а-яёa-z0-9]/g, '');
  
  return FORBIDDEN_ROOTS.some(root => 
    lowerText.includes(root) || cleanText.includes(root)
  );
};

/**
 * Максимально строгий фильтр русского мата и оскорблений.
 */
export const validateContentSafety = async (data: RiderData): Promise<{ isSafe: boolean; reason?: string }> => {
  const textToCheck = `
    Имя: ${data.name}
    Локация: ${data.location}
    Техника: ${data.gears.filter(g => g.trim()).join(', ')}
    О себе: ${data.about || ''}
  `.trim();

  // 1. Быстрая локальная проверка
  if (localProfanityCheck(textToCheck)) {
    return { isSafe: false, reason: "Local filter triggered" };
  }

  // 2. Глубокая проверка через AI
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `АНАЛИЗ ТЕКСТА НА НЕЦЕНЗУРНУЮ ЛЕКСИКУ: "${textToCheck}"`,
      config: {
        systemInstruction: `Ты — эксперт-модератор. Твоя задача: найти ЛЮБОЙ мат, оскорбления или завуалированную ругань в русском языке. 
        Учитывай: замену букв (х@й, пNзда), точки (б.л.я), пробелы (с у к а). 
        Если в тексте есть хоть ОДИН намек на мат — возвращай isSafe: false.
        Отвечай строго JSON: {"isSafe": boolean}`,
        responseMimeType: "application/json",
        // Fix: Use 'as any' to bypass string-to-enum assignment errors for HarmCategory and HarmBlockThreshold
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT' as any, threshold: 'BLOCK_NONE' as any },
          { category: 'HARM_CATEGORY_HATE_SPEECH' as any, threshold: 'BLOCK_NONE' as any },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT' as any, threshold: 'BLOCK_NONE' as any },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT' as any, threshold: 'BLOCK_NONE' as any }
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

    if (!response.text) {
      // Если Google заблокировал контент на своем уровне — значит там точно мат
      return { isSafe: false, reason: "API Content Block" };
    }

    const result = JSON.parse(response.text.trim());
    return result;
  } catch (error) {
    console.error("Safety check error:", error);
    // Если произошла ошибка API, мы проверяем текст еще раз на подозрительные символы
    // чтобы не пропустить мат при "падении" сервиса
    const suspicious = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(textToCheck);
    return { isSafe: !suspicious, reason: "Fallback security" };
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