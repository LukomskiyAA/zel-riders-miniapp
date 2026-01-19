import { GoogleGenAI, Type } from "@google/genai";
import { RiderData } from "./types";

// Список запрещенных паттернов. Используем границы слов \b там, где это возможно, 
// чтобы избежать ложных срабатываний (например, 'член клуба' или 'парикмахер').
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
  /\bхер\b/i // Только как отдельное слово
];

/**
 * Локальная проверка на мат (быстрая).
 */
const localProfanityCheck = (text: string): boolean => {
  const lowerText = text.toLowerCase();
  
  // Проверка по списку регулярных выражений
  if (PROFANITY_REGEX.some(regex => regex.test(lowerText))) {
    return true;
  }

  // Проверка на скрытый мат (буквы через точки/символы)
  // Очищаем только от спецсимволов, оставляя буквы
  const cleanLetters = lowerText.replace(/[^а-яё]/g, '');
  // Проверяем очищенную строку только на самые жесткие корни
  const strictRoots = [/хуй/i, /пизд/i, /еба/i, /ебу/i, /бля/i];
  if (strictRoots.some(regex => regex.test(cleanLetters))) {
    return true;
  }
  
  return false;
};

/**
 * Валидация контента на безопасность.
 */
export const validateContentSafety = async (data: RiderData): Promise<{ isSafe: boolean; reason?: string }> => {
  const textToCheck = `
    ${data.name} 
    ${data.location} 
    ${data.gears.join(' ')} 
    ${data.about || ''}
  `.trim();

  // 1. Быстрая локальная проверка
  if (localProfanityCheck(textToCheck)) {
    return { isSafe: false, reason: "Local filter" };
  }

  // 2. AI проверка для сложных случаев
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Проверь текст на мат: "${textToCheck}"`,
      config: {
        systemInstruction: `Ты — модератор. Ищи мат и оскорбления. 
        Игнорируй обычные знаки препинания и технические термины.
        Слова "член клуба", "руль", "херсон" — это НЕ мат.
        Отвечай JSON: {"isSafe": boolean}`,
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

    if (!response.text) return { isSafe: false, reason: "Blocked" };
    return JSON.parse(response.text.trim());
  } catch (error) {
    // Если AI упал, доверяем локальному фильтру (который уже прошел)
    return { isSafe: true };
  }
};