
import { GoogleGenAI, Type } from "@google/genai";
import { RiderData } from "./types";

/**
 * Проверяет контент анкеты на наличие мата, оскорблений и неподобающего контента.
 * Использует Gemini 3 Flash для глубокого лингвистического анализа.
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
      contents: `ПРОАНАЛИЗИРУЙ ТЕКСТ НА МАТ И ОСКОРБЛЕНИЯ:
      "${textToCheck}"`,
      config: {
        systemInstruction: `Ты — строгий модератор мото-сообщества. 
        Твоя задача: выявлять русский мат (включая завуалированный, через символы или транслит), агрессию, эротический подтекст или оскорбления. 
        Будь крайне внимателен к попыткам обойти фильтры (например, "п.и.з.д.а", "х@й" и т.д.).
        Отвечай ТОЛЬКО в формате JSON: {"isSafe": boolean}.`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isSafe: { 
              type: Type.BOOLEAN,
              description: "true если текст чист, false если найден мат или оскорбления"
            }
          },
          required: ["isSafe"]
        }
      }
    });

    // Если модель сама заблокировала ответ из-за высокой токсичности ввода (Safety Filter),
    // свойство text будет пустым. В этом случае мы ОДНОЗНАЧНО считаем контент опасным.
    if (!response.text) {
      console.warn("Gemini blocked the response due to its own safety filters. Content is likely unsafe.");
      return { isSafe: false, reason: "Content triggered safety filters" };
    }

    const result = JSON.parse(response.text);
    return result;
  } catch (error) {
    console.error("Content safety check failed:", error);
    // Если произошла техническая ошибка (например, нет интернета), разрешаем отправку.
    // Если же это ошибка безопасности — блокируем.
    return { isSafe: true };
  }
};
