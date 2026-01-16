
export interface SocialEntry {
  platform: string;
  handle: string;
}

export interface RiderData {
  name: string;
  age: string;
  location: string;
  gear: string;
  season: string;
  socials: SocialEntry[];
  tgUserId?: number; // Added to link to profile
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
