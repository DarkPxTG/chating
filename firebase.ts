
import { User, Chat, Message, Story, AdConfig, CallSession, LiveStream, StreamMessage } from './types';
import { INITIAL_CHATS, MOCK_STORIES } from './constants';

/**
 * 🚀 ULTIMATE INDEXED-DB ENGINE
 */

const DB_NAME = 'UltimateMessenger_V3';
const DB_VERSION = 3; 

const STORES = {
  USERS: 'users',
  CHATS: 'chats',
  MESSAGES: 'messages',
  STORIES: 'stories',
  ADS: 'ads',
  CALLS: 'calls',
  STREAM: 'stream', 
  SESSION: 'session' 
};

// --- Low Level IndexedDB Wrapper ---
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORES.USERS)) db.createObjectStore(STORES.USERS, { keyPath: 'uid' });
      if (!db.objectStoreNames.contains(STORES.CHATS)) db.createObjectStore(STORES.CHATS, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORES.MESSAGES)) db.createObjectStore(STORES.MESSAGES, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORES.STORIES)) db.createObjectStore(STORES.STORIES, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORES.ADS)) db.createObjectStore(STORES.ADS, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORES.CALLS)) db.createObjectStore(STORES.CALLS, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORES.STREAM)) db.createObjectStore(STORES.STREAM, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORES.SESSION)) db.createObjectStore(STORES.SESSION, { keyPath: 'key' });
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const dbOp = async (storeName: string, mode: IDBTransactionMode, callback: (store: IDBObjectStore) => IDBRequest | void) => {
  const db = await openDB();
  return new Promise<any>((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const request = callback(store);

    tx.oncomplete = () => {
        db.close();
        if (request && 'result' in request) {
             resolve(request.result);
        } else {
             resolve(true);
        }
    };
    tx.onerror = () => {
        db.close();
        reject(tx.error);
    };
    if (request) {
        request.onsuccess = () => {}; 
    }
  });
};

// --- Real-time Simulation ---
const triggerUpdate = () => {
  window.dispatchEvent(new Event('server-update'));
};

// --- Multi-Account Auth System ---
export const auth = {
  currentUser: null as User | null,
  
  onAuthStateChanged: (cb: (user: User | null) => void) => {
    // Check localStorage for active session
    const activeUid = localStorage.getItem('active_account_uid');
    
    const loadUser = async () => {
        if(activeUid) {
            const user = await db.users.get(activeUid);
            auth.currentUser = user || null;
        } else {
            auth.currentUser = null;
        }
        cb(auth.currentUser);
    };
    
    loadUser();

    const checkSession = () => loadUser();
    window.addEventListener('auth-change', checkSession);
    return () => window.removeEventListener('auth-change', checkSession);
  },

  login: (user: User) => {
      // Add to accounts list in localStorage
      const accountsStr = localStorage.getItem('accounts_list');
      let accounts: string[] = accountsStr ? JSON.parse(accountsStr) : [];
      if(!accounts.includes(user.uid)) {
          if (accounts.length >= 3) {
              alert("Maximum 3 accounts allowed. Please remove one first.");
              return;
          }
          accounts.push(user.uid);
          localStorage.setItem('accounts_list', JSON.stringify(accounts));
      }
      
      localStorage.setItem('active_account_uid', user.uid);
      auth.currentUser = user;
      window.dispatchEvent(new Event('auth-change'));
  },

  switchAccount: (uid: string) => {
      localStorage.setItem('active_account_uid', uid);
      window.dispatchEvent(new Event('auth-change'));
  },

  getAccounts: async (): Promise<User[]> => {
      const accountsStr = localStorage.getItem('accounts_list');
      const uids: string[] = accountsStr ? JSON.parse(accountsStr) : [];
      const users = [];
      for(const uid of uids) {
          const u = await db.users.get(uid);
          if(u) users.push(u);
      }
      return users;
  },

  logout: () => {
      if(!auth.currentUser) return;
      const uidToRemove = auth.currentUser.uid;
      const accountsStr = localStorage.getItem('accounts_list');
      let accounts: string[] = accountsStr ? JSON.parse(accountsStr) : [];
      
      accounts = accounts.filter(id => id !== uidToRemove);
      localStorage.setItem('accounts_list', JSON.stringify(accounts));
      
      if(accounts.length > 0) {
          localStorage.setItem('active_account_uid', accounts[0]);
      } else {
          localStorage.removeItem('active_account_uid');
      }
      
      window.dispatchEvent(new Event('auth-change'));
  }
};

export const signOut = () => {
    auth.logout();
};

// --- Database Engine ---
export const db = {
  users: {
    async create(user: User) {
      await dbOp(STORES.USERS, 'readwrite', store => store.put(user));
      return user;
    },
    async get(uid: string) {
      return await dbOp(STORES.USERS, 'readonly', store => store.get(uid));
    },
    async getAll() {
        return await dbOp(STORES.USERS, 'readonly', store => store.getAll());
    },
    async search(queryStr: string) {
      const users: User[] = await dbOp(STORES.USERS, 'readonly', store => store.getAll());
      if (!queryStr) return users;
      const q = queryStr.replace(/@/g, '').toLowerCase().trim();
      return users.filter(u => 
        u.username.toLowerCase().includes(q) || 
        u.displayName.toLowerCase().includes(q) ||
        u.uid.toLowerCase().includes(q)
      );
    },
    async update(uid: string, data: Partial<User>) {
      const user = await dbOp(STORES.USERS, 'readonly', store => store.get(uid));
      if (user) {
        const updated = { ...user, ...data };
        await dbOp(STORES.USERS, 'readwrite', store => store.put(updated));
        
        if (auth.currentUser?.uid === uid) {
             auth.currentUser = updated;
        }
        triggerUpdate(); 
      }
    },
    // Heartbeat to keep user online
    async heartbeat(uid: string) {
        const user = await dbOp(STORES.USERS, 'readonly', store => store.get(uid));
        if (user) {
            user.presence = {
                ...user.presence,
                isOnline: true,
                lastSeen: Date.now()
            };
            await dbOp(STORES.USERS, 'readwrite', store => store.put(user));
            triggerUpdate();
        }
    }
  },

  chats: {
    async getMyChats(uid: string) {
      let allChats: Chat[] = await dbOp(STORES.CHATS, 'readonly', store => store.getAll());
      if (allChats.length === 0) {
          for (const c of INITIAL_CHATS) await dbOp(STORES.CHATS, 'readwrite', s => s.put(c));
          allChats = INITIAL_CHATS;
      }
      return allChats.filter((c: Chat) => {
        if (c.type === 'channel') return true;
        if (c.type === 'group' && c.adminIds?.includes(uid)) return true;
        if (c.type === 'private' && c.id.includes(uid)) return true;
        return false;
      }).sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));
    },
    async create(chat: Chat) {
      await dbOp(STORES.CHATS, 'readwrite', store => store.put(chat));
      triggerUpdate();
    },
    async update(chatId: string, data: Partial<Chat>) {
        const chat = await dbOp(STORES.CHATS, 'readonly', store => store.get(chatId));
        if (chat) {
            await dbOp(STORES.CHATS, 'readwrite', store => store.put({ ...chat, ...data }));
            triggerUpdate();
        }
    },
    async delete(chatId: string) {
      await dbOp(STORES.CHATS, 'readwrite', store => store.delete(chatId));
      triggerUpdate();
    }
  },

  messages: {
    async send(chatId: string, message: Message) {
      await dbOp(STORES.MESSAGES, 'readwrite', store => store.put({ ...message, chatId }));
      const chat = await dbOp(STORES.CHATS, 'readonly', store => store.get(chatId));
      if (chat) {
          chat.lastMessage = message.text || (message.type === 'voice' ? 'Voice Message' : (message.type === 'media' ? (message.mediaType === 'video' ? 'Video' : 'Photo') : 'Media'));
          chat.lastMessageTime = message.localTimestamp;
          chat.time = 'Now';
          await dbOp(STORES.CHATS, 'readwrite', store => store.put(chat));
      } else {
          // Auto Create Private Chat if not exists
          const isPrivate = chatId.includes('_');
          const newChat: Chat = {
            id: chatId,
            name: 'Chat', 
            type: isPrivate ? 'private' : 'group',
            status: 'Active',
            avatar: '',
            lastMessage: message.text || 'Media',
            lastMessageTime: message.localTimestamp,
            unreadCount: 1,
            time: 'Now'
          };
          await dbOp(STORES.CHATS, 'readwrite', store => store.put(newChat));
      }
      triggerUpdate();
    },
    async delete(id: string) {
        await dbOp(STORES.MESSAGES, 'readwrite', store => store.delete(id));
        triggerUpdate();
    },
    subscribe(chatId: string, cb: (msgs: Message[]) => void) {
      const handler = async () => {
        const allMsgs: (Message & { chatId: string })[] = await dbOp(STORES.MESSAGES, 'readonly', store => store.getAll());
        const chatMsgs = allMsgs.filter(m => m.chatId === chatId).sort((a,b) => a.timestamp - b.timestamp);
        cb(chatMsgs);
      };
      window.addEventListener('server-update', handler);
      handler(); 
      return () => window.removeEventListener('server-update', handler);
    }
  },

  stories: {
    get(viewerUid: string) {
      return dbOp(STORES.STORIES, 'readonly', store => store.getAll()).then((allStories: Story[]) => {
          if (allStories.length === 0) return MOCK_STORIES;
          return allStories; 
      });
    },
    async add(story: Story) {
      await dbOp(STORES.STORIES, 'readwrite', store => store.put(story));
      triggerUpdate();
    }
  },

  calls: {
      async initiate(call: CallSession) {
          await dbOp(STORES.CALLS, 'readwrite', store => store.put(call));
          triggerUpdate();
      },
      async updateStatus(callId: string, status: 'connected' | 'ended' | 'rejected') {
          const call = await dbOp(STORES.CALLS, 'readonly', store => store.get(callId));
          if(call) {
              call.status = status;
              await dbOp(STORES.CALLS, 'readwrite', store => store.put(call));
              triggerUpdate();
          }
      },
      async getActiveCalls(userId: string) {
          const allCalls: CallSession[] = await dbOp(STORES.CALLS, 'readonly', store => store.getAll());
          return allCalls.filter(c => 
              (c.callerId === userId || c.receiverId === userId) && 
              c.status !== 'ended' && c.status !== 'rejected'
          );
      }
  },

  stream: {
      async get() {
          return await dbOp(STORES.STREAM, 'readonly', store => store.get('global_stream'));
      },
      async start(title: string, hostId: string) {
          const stream: LiveStream = {
              isActive: true,
              title,
              viewersCount: 0,
              startedAt: Date.now(),
              hostId,
              requests: [],
              messages: []
          };
          await dbOp(STORES.STREAM, 'readwrite', store => store.put({ ...stream, id: 'global_stream' }));
          triggerUpdate();
      },
      async stop() {
          await dbOp(STORES.STREAM, 'readwrite', store => store.delete('global_stream'));
          triggerUpdate();
      },
      async update(data: Partial<LiveStream>) {
          const stream = await dbOp(STORES.STREAM, 'readonly', store => store.get('global_stream'));
          if (stream) {
              await dbOp(STORES.STREAM, 'readwrite', store => store.put({ ...stream, ...data, id: 'global_stream' }));
              triggerUpdate();
          }
      },
      async addRequest(user: { userId: string, username: string, avatar: string }) {
          const stream: LiveStream = await dbOp(STORES.STREAM, 'readonly', store => store.get('global_stream'));
          if(stream && !stream.requests.find(r => r.userId === user.userId)) {
              stream.requests.push(user);
              await dbOp(STORES.STREAM, 'readwrite', store => store.put(stream));
              triggerUpdate();
          }
      },
      async removeRequest(userId: string) {
          const stream: LiveStream = await dbOp(STORES.STREAM, 'readonly', store => store.get('global_stream'));
          if(stream) {
              stream.requests = stream.requests.filter(r => r.userId !== userId);
              await dbOp(STORES.STREAM, 'readwrite', store => store.put(stream));
              triggerUpdate();
          }
      },
      async addMessage(msg: StreamMessage) {
          const stream: LiveStream = await dbOp(STORES.STREAM, 'readonly', store => store.get('global_stream'));
          if (stream) {
              stream.messages.push(msg);
              await dbOp(STORES.STREAM, 'readwrite', store => store.put(stream));
              triggerUpdate();
          }
      }
  },

  ads: {
    async set(ad: AdConfig) {
        await dbOp(STORES.ADS, 'readwrite', store => store.put(ad));
        triggerUpdate();
    },
    async getActive() {
        const ads: AdConfig[] = await dbOp(STORES.ADS, 'readonly', store => store.getAll());
        return ads.find(a => a.isActive);
    }
  }
};

(async function bootServer() {
  try {
      const users = await db.users.getAll();
      
      // CREATE ADMIN
      if (!users.find((u: User) => u.username === 'admin')) {
        const admin: User = {
          uid: 'admin_official',
          numericId: 1,
          username: 'admin',
          displayName: 'System Admin',
          password: '123',
          typoloBalance: 999999,
          gifts: [],
          joinedChannels: [],
          archivedChats: [],
          isAdmin: true,
          presence: { isOnline: true, lastSeen: Date.now(), statusHidden: false },
          sessions: [],
          blockedUsers: [],
          contacts: [],
          inviteLink: 'ultimate.app/admin',
          referralCount: 0,
          privacy: { inactivityMonths: 12, lastSeen: 'everybody', forwarding: 'everybody' }
        };
        await db.users.create(admin);
      }

      // CREATE BOTFATHER
      if (!users.find((u: User) => u.username === 'botfather')) {
          const botFather: User = {
              uid: 'bot_father_official',
              numericId: 2,
              username: 'botfather',
              displayName: 'BotFather',
              bio: 'BotFather is the one bot to rule them all. Use it to create new bot accounts and manage your existing bots.',
              avatar: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/Telegram_logo.svg/2048px-Telegram_logo.svg.png', // Placeholder
              isBot: true,
              typoloBalance: 0,
              gifts: [],
              joinedChannels: [],
              archivedChats: [],
              isAdmin: false,
              presence: { isOnline: true, lastSeen: Date.now(), statusHidden: false },
              sessions: [],
              blockedUsers: [],
              contacts: [],
              inviteLink: 'ultimate.app/botfather',
              referralCount: 0,
              privacy: { inactivityMonths: 12, lastSeen: 'everybody', forwarding: 'everybody' }
          };
          await db.users.create(botFather);
      }

  } catch (e) {
      console.error("DB Boot Failed", e);
  }
})();
