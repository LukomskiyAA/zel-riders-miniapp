
import { RiderData, AppSettings } from './types';

export const sendToTelegram = async (
  settings: AppSettings,
  data: RiderData,
  aiBio: string,
  photos: File[]
) => {
  const { botToken, chatId, threadId } = settings;
  const baseUrl = `https://api.telegram.org/bot${botToken}`;

  const userMention = data.tgUserId 
    ? `[${data.name}](tg://user?id=${data.tgUserId})`
    : `*${data.name}*`;

  const validSocials = data.socials.filter(s => s.handle.trim() !== '');
  const socialInfo = validSocials.length > 0
    ? validSocials.map(s => `${s.platform}: ${s.handle}`).join('\n🔗 ')
    : 'Не указано';

  const caption = `
🏁 *Новая анкета участника!*
━━━━━━━━━━━━━━━━━━
👤 *Райдер:* ${userMention}
🎂 *Возраст:* ${data.age || 'Секрет'}
📍 *Локация:* ${data.location}
🏍 *Техника:* ${data.gear}
⏱ *Стаж:* ${data.season} сезон(ов)

🔗 *Контакты:*
${socialInfo}

📝 *О себе (AI):*
_${aiBio}_
━━━━━━━━━━━━━━━━━━
#анкета #zelriders
  `.trim();

  try {
    const formData = new FormData();
    formData.append('chat_id', chatId);
    if (threadId) formData.append('message_thread_id', threadId);

    if (photos.length === 0) {
      const response = await fetch(`${baseUrl}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          message_thread_id: threadId,
          text: caption,
          parse_mode: 'Markdown',
        }),
      });
      return await response.json();
    } else {
      const media = photos.map((_, index) => ({
        type: 'photo',
        media: `attach://photo${index}`,
        caption: index === 0 ? caption : undefined,
        parse_mode: 'Markdown',
      }));

      formData.append('media', JSON.stringify(media));
      photos.forEach((photo, index) => {
        formData.append(`photo${index}`, photo);
      });

      const response = await fetch(`${baseUrl}/sendMediaGroup`, {
        method: 'POST',
        body: formData,
      });
      return await response.json();
    }
  } catch (error) {
    console.error('Telegram API Error:', error);
    throw error;
  }
};
