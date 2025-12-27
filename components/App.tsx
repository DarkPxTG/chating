
import React, { useState, useEffect, useMemo } from 'react';
import { User, Chat, Message, Story, CallSession, LiveStream } from '../types';
import { MOCK_STORIES } from './constants';
import { auth as localAuth, db as localDB, signOut } from './firebase'; 
import AuthScreen from './components/AuthScreen';
import ChatList from './components/ChatList';
import ChatView from './components/ChatView';
import Drawer from './components/Drawer';
import Header from './components/Header';
import StoryViewer from './components/StoryViewer';
import CallOverlay from './components/CallOverlay';
import AdminPanel from './components/AdminPanel';
import { BackgroundPickerModal, ProfileModal, GiftsModal, InvitesModal, CreateChatModal, StreamModal, MiniAppModal } from './components/Modals';
import { monitorService } from './MonitorService';

// --- IMAGE COMPRESSION UTILITY ---
const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        // Max dimensions 1080p to save space
        const MAX_WIDTH = 1080;
        const MAX_HEIGHT = 1920;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        // Compress to JPEG 0.7 quality
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
    };
  });
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [searchResults, setSearchResults] = useState<Chat[]>([]);
  const [stories, setStories] = useState<Story[]>(MOCK_STORIES);
  const [activeStory, setActiveStory] = useState<Story | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isBGModalOpen, setIsBGModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isGiftsModalOpen, setIsGiftsModalOpen] = useState(false);
  const [isInvitesModalOpen, setIsInvitesModalOpen] = useState(false);
  const [isCreateChatModalOpen, setIsCreateChatModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [activeTab, setActiveTab] = useState('All');
  const [snowEnabled, setSnowEnabled] = useState(true);
  
  const [incomingCall, setIncomingCall] = useState<CallSession | null>(null);
  const [activeStream, setActiveStream] = useState<LiveStream | null>(null);
  const [showStreamModal, setShowStreamModal] = useState(false);

  // Mini App State
  const [miniAppUrl, setMiniAppUrl] = useState('');
  const [miniAppTitle, setMiniAppTitle] = useState('');
  const [showMiniApp, setShowMiniApp] = useState(false);

  // 1. Auth Listener
  useEffect(() => {
    const unsubscribe = localAuth.onAuthStateChanged(async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        monitorService.startMonitoring();
        
        // Initial Chat Fetch
        const userChats = await localDB.chats.getMyChats(currentUser.uid);
        setChats(userChats);
        
        // Initial Story Fetch
        const userStories = await localDB.stories.get(currentUser.uid);
        setStories(userStories);
      } else {
        setUser(null);
        setChats([]);
      }
    });
    return () => unsubscribe();
  }, []);

  // 2. Heartbeat System (Updates Last Seen every minute)
  useEffect(() => {
      if (!user) return;
      
      const interval = setInterval(() => {
          localDB.users.heartbeat(user.uid);
      }, 60000); // 1 minute

      // Initial beat
      localDB.users.heartbeat(user.uid);

      return () => clearInterval(interval);
  }, [user?.uid]);

  // 3. Global Server Event Listener (The "Socket")
  useEffect(() => {
    if (!user) return;
    
    const handleServerUpdate = async () => {
      // Refresh User Data (Check Ban Status & Balance)
      const freshUser = await localDB.users.get(user.uid);
      if (freshUser) {
        setUser(freshUser); // Updates the UI with new ban status/balance
      }

      // Refresh Chats
      const updatedChats = await localDB.chats.getMyChats(user.uid);
      setChats(updatedChats);
      
      // Refresh Stories (Filtered)
      const updatedStories = await localDB.stories.get(user.uid);
      setStories(updatedStories);

      // Check Calls
      const calls = await localDB.calls.getActiveCalls(user.uid);
      // Logic for incoming/outgoing call overlay
      const activeCall = calls.find(c => 
          (c.receiverId === user.uid && c.status === 'ringing') || 
          (c.callerId === user.uid && c.status !== 'ended' && c.status !== 'rejected') ||
          (c.receiverId === user.uid && c.status === 'connected')
      );
      setIncomingCall(activeCall || null);

      // Check Streams
      const stream = await localDB.stream.get();
      setActiveStream(stream || null);
      if(!stream) setShowStreamModal(false); // Close if ended
    };

    const handleJoinStream = () => setShowStreamModal(true);

    // Listen for Mini App Open Event
    const handleOpenMiniApp = (e: any) => {
        if(e.detail && e.detail.url) {
            setMiniAppUrl(e.detail.url);
            setMiniAppTitle(e.detail.title || 'Mini App');
            setShowMiniApp(true);
        }
    };

    window.addEventListener('server-update', handleServerUpdate);
    window.addEventListener('join-stream', handleJoinStream);
    window.addEventListener('open-mini-app', handleOpenMiniApp);
    
    return () => {
        window.removeEventListener('server-update', handleServerUpdate);
        window.removeEventListener('join-stream', handleJoinStream);
        window.removeEventListener('open-mini-app', handleOpenMiniApp);
    }
  }, [user?.uid]); 

  // 4. GLOBAL SEARCH LOGIC (FIXED)
  useEffect(() => {
    if (!isSearching || !searchQuery.trim() || !user) {
        setSearchResults([]);
        return;
    }

    const delaySearch = setTimeout(async () => {
        // Search all users in DB
        const foundUsers = await localDB.users.search(searchQuery);
        
        // Convert Users to Chat Objects for display
        const resultsAsChats: Chat[] = foundUsers
            .filter(u => u.uid !== user.uid) // Don't show myself
            .map(u => {
                // Check if we already have a chat with this user
                const existingChat = chats.find(c => 
                    c.type === 'private' && c.id.includes(u.uid)
                );

                if (existingChat) return existingChat;

                // Construct a standard Chat ID for new interaction
                // IMPORTANT: We use adminIds to store the two participants for robust identification
                const chatId = [user.uid, u.uid].sort().join('_');

                return {
                    id: chatId, 
                    name: u.displayName,
                    avatar: u.avatar || '',
                    type: 'private',
                    status: 'active',
                    lastMessage: '@' + u.username, // Show username to indicate it's a user result
                    lastMessageTime: Date.now(),
                    unreadCount: 0,
                    time: '',
                    adminIds: [user.uid, u.uid] // CRITICAL: Store both UIDs here
                } as Chat;
            });
            
        setSearchResults(resultsAsChats);
    }, 300); // 300ms Debounce

    return () => clearTimeout(delaySearch);
  }, [searchQuery, isSearching, user, chats]);


  // 5. Story Upload Logic (FIXED WITH COMPRESSION)
  const handleAddStory = async (file: File) => {
    if (!user) return;
    
    try {
        // Compress image first to avoid storage limits and loading issues
        const compressedBase64 = await compressImage(file);
        
        const newStory: Story = {
            id: `story_${Date.now()}`,
            userId: user.uid,
            username: user.displayName,
            avatar: user.avatar || '',
            seen: false,
            createdAt: Date.now(),
            expiresAt: Date.now() + 86400000,
            frames: [
            {
                id: `f_${Date.now()}`,
                title: 'New Story',
                description: '',
                image: compressedBase64,
                color: '#000'
            }
            ]
        };
        await localDB.stories.add(newStory);
    } catch (e) {
        alert('Failed to process image. Please try another one.');
        console.error(e);
    }
  };

  const handleUpdateUser = async (data: Partial<User>) => {
    if (!user) return;
    await localDB.users.update(user.uid, data);
  };

  const snowflakes = useMemo(() => {
    if (!snowEnabled) return [];
    return Array.from({ length: 45 }).map((_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      size: `${2 + Math.random() * 5}px`,
      duration: `${6 + Math.random() * 12}s`,
      delay: `${Math.random() * 10}s`
    }));
  }, [snowEnabled]);

  // --- BAN SCREEN (RED SCREEN OF DEATH) ---
  if (user && user.isBanned) {
    return (
      <div className="fixed inset-0 bg-[#350b0b] flex flex-col items-center justify-center z-[9999] text-white p-10 text-center animate-fade-in">
        <div className="w-32 h-32 bg-red-600 rounded-full flex items-center justify-center mb-8 shadow-[0_0_50px_rgba(220,38,38,0.6)] animate-pulse">
           <i className="fa-solid fa-xmark text-6xl"></i>
        </div>
        <h1 className="text-3xl font-black uppercase tracking-widest mb-4">Account Banned</h1>
        <p className="text-red-200 mb-10 font-medium">
          Your account has been suspended for violating our terms of service.<br/>
          Error Code: #BAN_User_{user.numericId}
        </p>
        <button 
          onClick={() => { signOut(); setUser(null); }} 
          className="bg-white text-red-900 px-8 py-4 rounded-2xl font-black text-lg hover:scale-105 transition-transform"
        >
          LOGOUT NOW
        </button>
      </div>
    );
  }

  if (isAdminMode) {
    return <AdminPanel onExit={() => setIsAdminMode(false)} />;
  }

  if (!user) {
    return <AuthScreen onLogin={setUser} onAdminLogin={() => setIsAdminMode(true)} />;
  }

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0b141d] overflow-hidden font-sans relative" dir="ltr">
      <div className="snow-container">
        {snowflakes.map(s => (
          <div 
            key={s.id} 
            className="snowflake" 
            style={{ left: s.left, width: s.size, height: s.size, animationDuration: s.duration, animationDelay: s.delay }} 
          />
        ))}
      </div>

      <Header 
        onMenuClick={() => setIsDrawerOpen(true)}
        isSearching={isSearching}
        setIsSearching={(val) => { setIsSearching(val); if(!val) { setSearchQuery(''); setSearchResults([]); } }}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        stories={stories}
        onStoryClick={setActiveStory}
        onAddStory={handleAddStory}
        onGlobalAction={(act) => {
          if (act === 'background') setIsBGModalOpen(true);
          if (act === 'profile') setIsProfileModalOpen(true);
          if (act === 'invite') setIsInvitesModalOpen(true);
        }}
      />
      
      {/* Rest of the app remains same, just ensuring context is correct */}
      <div className="flex-1 overflow-hidden relative bg-[#0b141d]/50 z-10">
        <ChatList 
          // If searching, show searchResults. If results empty but query exists, it means "No results found" (handled by empty list)
          // If NOT searching, show normal chats.
          chats={isSearching ? searchResults : chats} 
          searchQuery={searchQuery} 
          activeTab={activeTab} 
          archivedChats={user.archivedChats || []}
          onChatClick={(c) => { setActiveChat(c); setIsSearching(false); setSearchQuery(''); }} 
          onPin={async (id) => {
             // Find chat
             const chat = chats.find(c => c.id === id);
             if (chat) await localDB.chats.update(id, { pinned: !chat.pinned });
          }} 
          onArchive={async (id) => {
             const newArchived = user.archivedChats.includes(id) 
                ? user.archivedChats.filter(x => x !== id) 
                : [...user.archivedChats, id];
             await localDB.users.update(user.uid, { archivedChats: newArchived });
          }} 
          onDelete={async (id) => { if(confirm('Delete this chat permanently?')) await localDB.chats.delete(id); }} 
          onTabChange={setActiveTab}
        />
        
        {!isSearching && activeTab !== 'Archived' && (
          <button 
            onClick={() => setIsCreateChatModalOpen(true)} 
            className="absolute bottom-12 right-6 w-16 h-16 bg-gradient-to-tr from-[#24A1DE] to-[#00e5ff] text-white rounded-3xl shadow-[0_15px_45px_rgba(0,229,255,0.45)] flex items-center justify-center text-2xl z-20 active:scale-90 transition-all border border-white/20"
          >
            <i className="fa-solid fa-pen-to-square"></i>
          </button>
        )}
      </div>

      <Drawer 
        user={user} 
        isOpen={isDrawerOpen} 
        onClose={() => setIsDrawerOpen(false)} 
        onLogout={() => { signOut(); setUser(null); }} 
        onProfileClick={() => { setIsDrawerOpen(false); setIsProfileModalOpen(true); }}
        onGiftsClick={() => { setIsDrawerOpen(false); setIsGiftsModalOpen(true); }}
        onInvitesClick={() => { setIsDrawerOpen(false); setIsInvitesModalOpen(true); }}
        onContactsClick={() => {}} 
        onAdminClick={() => { setIsDrawerOpen(false); setIsAdminMode(true); }}
        snowEnabled={snowEnabled}
        onToggleSnow={() => setSnowEnabled(!snowEnabled)}
      />
      
      {activeChat && (
        <ChatView 
          chat={activeChat} user={user} 
          onBack={() => setActiveChat(null)} 
          onUpdateUser={handleUpdateUser}
          onMentionClick={(m) => console.log(m)} 
          onStartCall={(t) => {}} // Internal
        />
      )}

      {incomingCall && (
        <CallOverlay user={user} callData={incomingCall} onClose={() => setIncomingCall(null)} />
      )}
      
      {activeStream && showStreamModal && (
          <StreamModal isOpen={showStreamModal} onClose={() => setShowStreamModal(false)} user={user} stream={activeStream} />
      )}

      {/* Mini App Modal */}
      <MiniAppModal isOpen={showMiniApp} onClose={() => setShowMiniApp(false)} url={miniAppUrl} title={miniAppTitle} />

      <BackgroundPickerModal isOpen={isBGModalOpen} onClose={() => setIsBGModalOpen(false)} onSelect={(bg) => handleUpdateUser({ chatBackground: bg })} />
      <ProfileModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} user={user} onSave={handleUpdateUser} />
      <GiftsModal isOpen={isGiftsModalOpen} onClose={() => setIsGiftsModalOpen(false)} user={user} onUpdateUser={handleUpdateUser} />
      <InvitesModal isOpen={isInvitesModalOpen} onClose={() => setIsInvitesModalOpen(false)} user={user} onStartChat={setActiveChat} />
      <CreateChatModal isOpen={isCreateChatModalOpen} onClose={() => setIsCreateChatModalOpen(false)} user={user} onCreated={setActiveChat} />
      {activeStory && <StoryViewer story={activeStory} onClose={() => setActiveStory(null)} />}
    </div>
  );
};

export default App;
