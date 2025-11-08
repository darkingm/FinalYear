export enum MessageType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  FILE = 'FILE',
  SYSTEM = 'SYSTEM',
}

export enum ChatStatus {
  ACTIVE = 'ACTIVE',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
}

export interface IChatMessage {
  id: string;
  chatRoomId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  senderRole: string;
  type: MessageType;
  content: string;
  attachments?: string[];
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IChatRoom {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  supportAgentId?: string;
  supportAgentName?: string;
  supportAgentAvatar?: string;
  subject: string;
  status: ChatStatus;
  lastMessage?: string;
  lastMessageAt?: Date;
  unreadCount: number;
  createdAt: Date;
  updatedAt: Date;
  closedAt?: Date;
}

export interface ICreateChatRoomRequest {
  subject: string;
  initialMessage: string;
}

export interface ISendMessageRequest {
  chatRoomId: string;
  type: MessageType;
  content: string;
  attachments?: string[];
}

export interface IChatNotification {
  chatRoomId: string;
  message: IChatMessage;
  recipientId: string;
}

