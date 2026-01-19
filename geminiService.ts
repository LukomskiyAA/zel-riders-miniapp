
import { GoogleGenAI, Type } from "@google/genai";
import { RiderData } from "./types";

export const validateContentSafety = async (data: RiderData): Promise<{ isSafe: boolean; reason?: string }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const textToCheck = `
    Имя: ${data.name}
    Локация: ${data.location}
    Техника: ${data.gears.join(', ')}
    О себе: ${data.about || ''}
  `.trim();

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Проверь следующий текст на наличие русской нецензурной лексики (мата), оскорблений или крайне неподобающего контента. 
      Текст: "${textToCheck}"
      Верни ответ строго в формате JSON: {"isSafe": boolean}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isSafe: { type: Type.BOOLEAN }
          },
          required: ["isSafe"]
        }
      }
    });

    const result = JSON.parse(response.text || '{"isSafe": true}');
    return result;
  } catch (error) {
    console.error("Content safety check failed:", error);
    // В случае ошибки API разрешаем отправку, чтобы не блокировать честных пользователей
    return { isSafe: true };
  }
};
