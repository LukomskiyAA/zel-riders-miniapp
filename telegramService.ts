
import { RiderData, AppSettings } from './types';

const escapeHTML = (text: string): string => {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
};

export const sendToTelegram = async (
  settings: AppSettings,
  data: RiderData,
  photos: File[]
) => {
  const { botToken, chatId, threadId } = settings;
  const baseUrl = `https://api.telegram.org/bot${botToken}`;

  // Формируем активную ссылку на профиль пользователя
  let userMention = `<b>${escapeHTML(data.name)}</b>`;
  if (data.tgUsername) {
    userMention = `<a href="https://t.me/${data.tgUsername}">${escapeHTML(data.name)}</a>`;
  } else if (data.tgUserId) {
    userMention = `<a href="tg://user?id=${data.tgUserId}">${escapeHTML(data.name)}</a>`;
  }

  const validSocials = data.socials.filter(s => s.handle.trim() !== '');
  const socialInfo = validSocials.length > 0
    ? validSocials.map(s => `<b>${escapeHTML(s.platform)}:</b> ${escapeHTML(s.handle)}`).join('\n🔗 ')
    : 'Не указано';

  // Финальный чистый формат без полосок и заголовков
  const caption = `
👤 <b>Имя:</b> ${userMention}
🎂 <b>Возраст:</b> ${escapeHTML(data.age || 'Секрет')}
📍 <b>Локация:</b> ${escapeHTML(data.location)}
🏍 <b>Техника:</b> ${escapeHTML(data.gear)}
⏱ <b>Стаж:</b> ${escapeHTML(data.season)} сезон(ов)

🔗 <b>Контакты:</b>
${socialInfo}
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
          parse_mode: 'HTML',
          disable_web_page_preview: true
        }),
      });
      return await response.json();
    } else {
      const media = photos.map((_, index) => ({
        type: 'photo',
        media: `attach://photo${index}`,
        caption: index === 0 ? caption : undefined,
        parse_mode: 'HTML',
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
