
import { Chat, Gift, Story } from './types';

export const HELPER_CHAT_ID = "official_helper_channel";
export const ADMIN_CHAT_ID = "admin_channel_secure";

const now = Date.now();
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

export const INITIAL_CHATS: Chat[] = [
  {
    id: HELPER_CHAT_ID,
    name: 'تیم پشتیبانی',
    status: 'Ready Only',
    avatar: 'H',
    type: 'channel',
    lastMessage: 'Tap here for a comprehensive guide on all features.',
    time: 'Always',
    unreadCount: 0,
    pinned: true
  }
];

export const MOCK_STORIES: Story[] = [
  { 
    id: 'official_guide_story', 
    userId: 'admin_official', 
    username: 'Ultimate App', 
    avatar: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/Telegram_logo.svg/2048px-Telegram_logo.svg.png', 
    seen: false,
    createdAt: now,
    expiresAt: now + THREE_DAYS_MS,
    frames: [
      {
        id: 'f1',
        title: 'خوش آمدید',
        description: 'به نسل جدید پیام‌رسانی با سرعت و امنیت فوق‌العاده خوش آمدید.',
        image: 'https://images.unsplash.com/photo-1611606063065-ee7946f0787a?auto=format&fit=crop&q=80&w=1000',
        color: '#24A1DE'
      },
      {
        id: 'f2',
        title: 'امنیت پیشرفته',
        description: 'تمامی گفتگوهای شما با پروتکل‌های نظامی رمزنگاری می‌شوند.',
        image: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&q=80&w=1000',
        color: '#1a1a1a'
      },
      {
        id: 'f3',
        title: 'جوایز Typolo',
        description: 'با فعالیت در برنامه، امتیاز بگیرید و گیفت‌های NFT بخرید.',
        image: 'https://images.unsplash.com/photo-1621504450181-5d356f63d3ee?auto=format&fit=crop&q=80&w=1000',
        color: '#ffd700'
      }
    ]
  }
];

// Fixed NFT_GIFTS: converted id to string, renamed image to emoji, and removed extra fields to match the Gift interface
export const NFT_GIFTS: Gift[] = [
  { id: "1", name: "Golden Crown", price: 50, emoji: "👑", rarity: "Legendary" }
];

export const POPULAR_EMOJIS = ['😂', '❤️', '👍', '🙏', '😭', '😊', '😍', '🔥'];

export const HELPER_GUIDE_TEXT = `
**Welcome to the Official Helper Channel!** 🛠️
Check our stories for a quick visual guide.
`;
