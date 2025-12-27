
export interface Gift {
  id: string;
  name: string;
  price: number;
  emoji: string;
  rarity: string;
}

export interface AdConfig {
  id: string;
  title: string;
  text: string;
  image?: string; // Base64
  link?: string;
  buttonText?: string;
  isActive: boolean;
  views: number;
}

export interface StreamMessage {
  id: string;
  userId: string;
  username: string;
  text: string;
  isDonation: boolean;
  amount?: number;
  timestamp: number;
}

export interface LiveStream {
  isActive: boolean;
  title: string;
  viewersCount: number;
  startedAt: number;
  hostId: string; // Admin ID
  guestId?: string; // ID of the user allowed to join video
  guestName?: string;
  requests: { userId: string; username: string; avatar: string }[]; // Users requesting to join
  messages: StreamMessage[];
}

export interface User {
  uid: string;
  numericId: number;
  username: string;
  displayName: string;
  bio?: string;
  birthDate?: string; // YYYY-MM-DD
  phone?: string;
  password?: string;
  avatar?: string;
  typoloBalance: number;
  gifts: Gift[];
  joinedChannels: string[];
  archivedChats: string[];
  isAdmin: boolean;
  isBanned?: boolean;
  isBot?: boolean; 
  botToken?: string; 
  webAppUrl?: string; // New: URL for the bot's Mini App
  ownedBots?: string[]; 
  chatBackground?: string;
  presence: {
    isOnline: boolean;
    lastSeen: number;
    statusHidden: boolean;
  };
  sessions: Session[];
  blockedUsers: string[];
  contacts: string[];
  inviteLink: string;
  inviterUid?: string;
  referralCount: number;
  usernameChangeTimestamp?: number;
  privacy: {
    inactivityMonths: number;
    transferToId?: string;
    lastSeen: 'everybody' | 'contacts' | 'nobody';
    forwarding: 'everybody' | 'nobody';
  };
}

export interface Session {
  id: string;
  deviceName: string;
  os: string;
  ip?: string;
  lastActive: number;
  appVersion: string;
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  text?: string;
  audio?: string;
  mediaUrl?: string; // For images/videos
  mediaType?: 'image' | 'video' | 'file';
  type: 'text' | 'voice' | 'system' | 'media';
  status: 'pending' | 'sent' | 'read' | 'failed';
  replyToId?: string;
  forwardedFromId?: string;
  isForwarded: boolean;
  forwardHidden?: boolean;
  timestamp: any;
  localTimestamp: number;
  seenBy: string[];
  isDeleted: boolean;
  editHistory: { text: string; time: number }[];
  reactions: Reaction[];
}

export interface Reaction {
  emoji: string;
  userIds: string[];
}

export interface Chat {
  id: string;
  name: string;
  status: string;
  avatar: string;
  type: 'private' | 'group' | 'channel';
  lastMessage?: string;
  lastMessageTime?: number;
  time?: string;
  unreadCount?: number;
  pinned?: boolean;
  slowModeSeconds?: number;
  adminIds?: string[]; // Used for group members as well in this simplified schema
  peerAvatar?: string;
}

export interface Story {
  id: string;
  userId: string;
  username: string;
  avatar: string;
  frames: StoryFrame[];
  seen: boolean;
  createdAt: number;
  expiresAt: number;
}

export interface StoryFrame {
  id: string;
  title: string;
  description: string;
  image: string;
  color: string;
}

export interface CallSession {
  id: string;
  callerId: string;
  callerName: string;
  callerAvatar: string;
  receiverId: string;
  type: 'audio' | 'video';
  status: 'ringing' | 'connected' | 'ended' | 'rejected';
  timestamp: number;
}
