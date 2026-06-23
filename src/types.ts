export interface AgentTemplate {
  id: string;
  name: string;
  avatar: string;
  description: string;
  style: string;
  expectedOutcome: string;
  systemPrompt: string;
  isCustom?: boolean;
}

export interface Message {
  id: string;
  roomId: string; // Corresponds to teahouseId in new architecture
  role: 'creator' | 'participant' | 'agent' | 'system';
  userId: string;
  username: string;
  text: string;
  timestamp: number;
  agentId?: string; // Track which specific AI created it
  avatar?: string;  // Track sender emoji avatar
}

export interface Participant {
  id: string;
  nickname: string;
  role: 'creator' | 'participant';
  isTalking?: boolean;
  isMuted?: boolean;
}

export interface Room {
  id: string;
  name: string;
  description: string;
  expectedOutcome: string;
  status: 'active' | 'destroyed';
  agentNickname: string;
  agentPrompt: string;
  summaryHtml?: string;
  createdAt: number;
}

export interface RoomSession {
  room: Room;
  passwordHash: string; // Stored securely in-memory
  participants: Record<string, Participant>;
  messages: Message[];
}

export type TeahouseThemeKey = 'ai' | 'agent' | 'enterprise';
export type AppLanguage = 'zh' | 'en';
