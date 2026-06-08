export interface Message {
  id: string;
  roomId: string;
  role: 'creator' | 'participant' | 'agent' | 'system';
  userId: string;
  username: string;
  text: string;
  timestamp: number;
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
