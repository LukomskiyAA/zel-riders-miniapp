
import { GoogleGenAI, Type } from "@google/genai";
import { RiderData } from "./types";

// Список запрещенных корней и паттернов для мгновенной локальной проверки
// Используем регулярные выражения для более точного поиска без ложных срабатываний
const PROFANITY_REGEX = [
  /хуй/i, /хуе/i, /хуи/i, /хуя/i, /хул/i,
  /пизд/i,
  /еба/i, /еби/i, /ебл/i, /ебу/i, /ебт/i, /ёб/i,
  /бля/i,
  /сука/i, /суч/i,
  /муд[аои]/i,
  /гондон/i, /гандон/i,
  /залуп/i,
  /манда/i,
  /дроч/i,
  /член/i,
  /хер/i
];

/**
 * Локальная проверка на мат (быстрая).
 * Проверяет наличие корней, игнорируя типичные знаки препинания.
 */
const localProfanityCheck = (text: string): boolean => {
  const lowerText = text.toLowerCase();
  
  // Проверка по списку регулярных выражений
  if (PROFANITY_REGEX.some(regex => regex.test(lowerText))) {
    return true;
  }

  // Очистка от "мусора" (точки между буквами и т.д.) только для специфической проверки
  // Но делаем это аккуратно, чтобы не задеть нормальные слова
  const hiddenCuss = lowerText.replace(/[^а-яё]/g, '');
  if (PROFANITY_REGEX.some(regex => regex.test(hiddenCuss))) {
    return true;
  }
  
  return false;
};

/**
 * Максимально строгий фильтр русского мата и оскорблений.
 */
export const validateContentSafety = async (data: RiderData): Promise<{ isSafe: boolean; reason?: string }> => {
  const textToCheck = `
    ${data.name} 
    ${data.location} 
    ${data.gears.join(' ')} 
    ${data.about || ''}
  `.trim();

  // 1. Быстрая локальная проверка (всегда работает)
  if (localProfanityCheck(textToCheck)) {
    console.warn("Safety check: Local filter triggered");
    return { isSafe: false, reason: "Local filter triggered" };
  }

  // 2. Глубокая проверка через AI (если доступно)
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `ПРОАНАЛИЗИРУЙ ТЕКСТ НА НАЛИЧИЕ МАТА И ОСКОРБЛЕНИЙ: "${textToCheck}"`,
      config: {
        systemInstruction: `Ты — модератор сообщества. Твоя задача — найти мат (включая завуалированный). 
        Если в тексте есть мат, верни isSafe: false. 
        Если текст нормальный (даже если там есть точки, запятые, слэши), верни isSafe: true.
        Отвечай ТОЛЬКО JSON: {"isSafe": boolean}`,
        responseMimeType: "application/json",
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
      // Если Google заблокировал ответ на уровне своих фильтров, там точно что-то не то
      return { isSafe: false, reason: "API strict block" };
    }

    const result = JSON.parse(response.text.trim());
    return result;
  } catch (error) {
    console.error("Safety check AI error (using local only):", error);
    // Если нейросеть упала (ошибка API), мы доверяем локальному фильтру, который уже прошел выше.
    // Больше не блокируем за "спецсимволы", чтобы не мешать нормальным пользователям.
    return { isSafe: true, reason: "Fallback to local" };
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
