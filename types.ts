
export interface SocialEntry {
  platform: string;
  handle: string;
}

export interface RiderData {
  name: string;
  age: string;
  location: string;
  gears: string[]; // Массив байков
  season: string;
  socials: SocialEntry[];
  about?: string; // Поле "О себе"
  tgUserId?: number;
  tgUsername?: string;
}

export interface AppSettings {
  botToken: string;
  chatId: string;
  threadId?: string;
}

export interface PhotoFile {
  file: File;
  preview: string;
}
