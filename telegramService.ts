
import { RiderData, AppSettings } from './types';

const escapeHTML = (text: string): string => {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
};

const formatSocialLink = (platform: string, handle: string): string => {
  const cleanHandle = handle.trim().replace(/^@/, '');
  if (!cleanHandle) return '';
  
  let url = '';
  if (platform === 'Telegram') url = `https://t.me/${cleanHandle}`;
  else if (platform === 'Instagram') url = `https://www.instagram.com/${cleanHandle}`;
  else if (platform === 'VK') url = `https://vk.com/${cleanHandle}`;
  
  return url ? `<a href="${url}">${url}</a>` : escapeHTML(handle);
};

/**
 * Проверяет статус участника в чате
 */
export const checkChatMembership = async (settings: AppSettings, userId: number): Promise<boolean> => {
  const { botToken, chatId } = settings;
  const url = `https://api.telegram.org/bot${botToken}/getChatMember?chat_id=${chatId}&user_id=${userId}`;

  try {
    const response = await fetch(url);
    const result = await response.json();
    if (result.ok) {
      const status = result.result.status;
      // Статусы, означающие, что пользователь в чате
      return ['member', 'administrator', 'creator'].includes(status);
    }
    return false;
  } catch (error) {
    console.error('Error checking membership:', error);
    return false;
  }
};

export const sendToTelegram = async (
  settings: AppSettings,
  data: RiderData,
  photos: File[]
) => {
  const { botToken, chatId, threadId } = settings;
  const baseUrl = `https://api.telegram.org/bot${botToken}`;

  let userMention = `<b>${escapeHTML(data.name)}</b>`;
  if (data.tgUsername) {
    userMention = `<a href="https://t.me/${data.tgUsername}">${escapeHTML(data.name)}</a>`;
  } else if (data.tgUserId) {
    userMention = `<a href="tg://user?id=${data.tgUserId}">${escapeHTML(data.name)}</a>`;
  }

  const gearsList = data.gears
    .filter(g => g.trim() !== '')
    .map(g => `• ${escapeHTML(g)}`)
    .join('\n');

  const validSocials = data.socials.filter(s => s.handle.trim() !== '');
  const socialInfo = validSocials.length > 0
    ? validSocials.map(s => `<b>${escapeHTML(s.platform)}:</b> ${formatSocialLink(s.platform, s.handle)}`).join('\n')
    : 'Не указано';

  const aboutSection = data.about?.trim() 
    ? `\n\n📝 <b>О себе:</b>\n<i>${escapeHTML(data.about)}</i>` 
    : '';

  const caption = `
👤 <b>Имя:</b> ${userMention}
🎂 <b>Возраст:</b> ${escapeHTML(data.age)}
📍 <b>Локация:</b> ${escapeHTML(data.location)}
⏱ <b>Стаж:</b> ${escapeHTML(data.season)} сезон(ов)

🏍 <b>Техника:</b>
${gearsList}

🔗 <b>Контакты:</b>
${socialInfo}${aboutSection}
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
