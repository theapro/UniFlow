export type ReceptionistLanguage = "UZ" | "EN" | "JP";
export type ReceptionistPersonality = "FRIENDLY" | "FORMAL";
export type ReceptionistMessageSender = "USER" | "ASSISTANT";
export type ReceptionistMessageModality = "TEXT" | "VOICE";

export type ReceptionistMessage = {
  id: string;
  sender: ReceptionistMessageSender;
  modality: ReceptionistMessageModality;
  text: string;
  createdAt: string;
};

export type ReceptionistAvatarConfig = {
  name: string;
  modelUrl: string | null;
  voice: string | null;
  language: ReceptionistLanguage;
  inputLanguage: ReceptionistLanguage;
  outputLanguage: ReceptionistLanguage;
  personality: ReceptionistPersonality;
};

export type ReceptionistAnnouncement = {
  id: string;
  title: string;
  content: string;
  targetAudience: string;
  language: ReceptionistLanguage | null;
  startsAt: string | null;
  endsAt: string | null;
};

export type ReceptionistInitData = {
  conversationId: string;
  avatar: ReceptionistAvatarConfig;
  announcements?: ReceptionistAnnouncement[];
  messages: ReceptionistMessage[];
};
