
import React, { useState, useEffect, useRef } from 'react';
import { Chat, User, Message, CallSession } from '../types';
import { db as localDB } from '../firebase';
import { getUserBadge } from '../VerifiedUsers';
import { getBadgeIcon, getBadgeStyle } from '../SupportDB';
import { UserProfileModal } from './Modals'; 

interface Props {
  chat: Chat;
  user: User;
  onBack: () => void;
  onUpdateUser: (data: Partial<User>) => void;
  onMentionClick: (mention: string) => void;
  onStartCall: (type: 'audio' | 'video') => void;
}

const EMOJI_LIST = ['😀','😂','😍','😭','😡','👍','👎','❤️','🔥','🎉','👻','👽','🤖','💩','💀','🤡','🫶','👀','☠️','👑','💎','💸','💣','💊','🩸','🔮','🧸','🎵','🎮','🚀'];

// BotFather State Types
type BotCreationStep = 'IDLE' | 'WAITING_FOR_NAME' | 'WAITING_FOR_USERNAME' | 'WAITING_FOR_BOT_SELECTION' | 'BOT_SETTINGS_MENU' | 'WAITING_FOR_WEB_APP_URL';

const ChatView: React.FC<Props> = ({ chat, user, onBack, onUpdateUser, onMentionClick, onStartCall }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [peerUser, setPeerUser] = useState<User | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Voice Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const recordInterval = useRef<number | null>(null);

  // Emoji Picker State
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Message Actions State
  const [longPressedMessage, setLongPressedMessage] = useState<Message | null>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);

  // BOTFATHER STATE (Local to this chat view session)
  const [botStep, setBotStep] = useState<BotCreationStep>('IDLE');
  const [tempBotName, setTempBotName] = useState('');
  const [myBotsList, setMyBotsList] = useState<User[]>([]);
  const [selectedBot, setSelectedBot] = useState<User | null>(null);

  useEffect(() => {
    if (chat.type === 'private') {
      let peerId = '';
      if (chat.adminIds && chat.adminIds.length > 0) {
          peerId = chat.adminIds.find(id => id !== user.uid) || '';
      } 
      if (!peerId) {
          if (chat.id.startsWith(user.uid + '_')) peerId = chat.id.substring(user.uid.length + 1);
          else if (chat.id.endsWith('_' + user.uid)) peerId = chat.id.substring(0, chat.id.length - user.uid.length - 1);
          else {
              const parts = chat.id.split('_');
              peerId = parts.find(p => p !== user.uid) || '';
          }
      }
      if (peerId) {
        localDB.users.get(peerId).then(u => setPeerUser(u));
        const updateListener = () => { localDB.users.get(peerId).then(u => setPeerUser(u)); };
        window.addEventListener('server-update', updateListener);
        return () => window.removeEventListener('server-update', updateListener);
      }
    }
  }, [chat.id, user.uid]);

  useEffect(() => {
    const unsubscribe = localDB.messages.subscribe(chat.id, (msgs) => {
      setMessages(msgs);
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }), 100);
    });
    return () => unsubscribe();
  }, [chat.id]);

  const handleStartCall = async (type: 'audio' | 'video') => {
      if(!peerUser) return alert('Connecting...');
      const callId = `call_${Date.now()}`;
      const newCall: CallSession = {
          id: callId,
          callerId: user.uid,
          callerName: user.displayName,
          callerAvatar: user.avatar || '',
          receiverId: peerUser.uid,
          type: type,
          status: 'ringing',
          timestamp: Date.now()
      };
      await localDB.calls.initiate(newCall);
  };

  const handleSendText = async () => {
    if (!inputText.trim()) return;
    const text = inputText;
    setInputText('');
    setReplyTo(null);
    setShowEmojiPicker(false);
    
    // Send User Message
    const msgData: Message = { 
      id: 'msg_' + Date.now(),
      senderId: user.uid, 
      senderName: user.displayName || user.username, 
      type: 'text', 
      text: text, 
      status: 'sent', 
      replyToId: replyTo?.id,
      timestamp: Date.now(), 
      localTimestamp: Date.now(), 
      seenBy: [user.uid], 
      isForwarded: false,
      isDeleted: false,
      editHistory: [],
      reactions: [] 
    };
    await localDB.messages.send(chat.id, msgData);

    // BOTFATHER LOGIC INTERCEPTOR
    const isBotFather = peerUser && (peerUser.username === 'botfather' || peerUser.uid === 'bot_father_official');
    if (isBotFather) {
        await processBotFatherCommand(text);
    }
  };

  const processBotFatherCommand = async (cmd: string) => {
      const lowerCmd = cmd.toLowerCase().trim().replace('/', ''); 
      let responseText = '';

      // COMMAND HANDLERS
      if (lowerCmd === 'cancel') {
          setBotStep('IDLE');
          setTempBotName('');
          setSelectedBot(null);
          responseText = "Current operation cancelled. Anything else I can do for you?\n\nSend /start for a list of commands.";
      }
      else if (botStep === 'IDLE') {
          if (lowerCmd === 'start') {
              responseText = `
I can help you create and manage Telegram bots. If you're new to the Bot API, please see the manual.

You can control me by sending these commands:

/newbot - create a new bot
/mybots - edit your bots
`;
          } else if (lowerCmd === 'newbot') {
              setBotStep('WAITING_FOR_NAME');
              responseText = "Alright, a new bot. How are we going to call it? Please choose a name for your bot.";
          } else if (lowerCmd === 'mybots') {
              const allUsers = await localDB.users.getAll();
              const myBots = allUsers.filter(u => u.isBot && u.inviterUid === user.uid); 
              setMyBotsList(myBots);
              
              if(myBots.length === 0) {
                  responseText = "You have currently no bots.";
              } else {
                  setBotStep('WAITING_FOR_BOT_SELECTION');
                  responseText = "Choose a bot from the list below:\n\n" + myBots.map((b, i) => `${i + 1}. @${b.username}`).join('\n');
              }
          } else {
              responseText = "I don't recognize that command. Try /start";
          }
      } 
      else if (botStep === 'WAITING_FOR_BOT_SELECTION') {
          const index = parseInt(cmd) - 1;
          if (!isNaN(index) && index >= 0 && index < myBotsList.length) {
              const bot = myBotsList[index];
              setSelectedBot(bot);
              setBotStep('BOT_SETTINGS_MENU');
              responseText = `You selected @${bot.username}. What do you want to do?
              
1. Edit Name
2. Edit Web App / Mini App
3. Back to list`;
          } else {
              responseText = "Invalid selection. Please send the number of the bot.";
          }
      }
      else if (botStep === 'BOT_SETTINGS_MENU') {
          if (cmd === '1') {
             responseText = "Editing names is not implemented in this demo version yet.";
          } else if (cmd === '2') {
             setBotStep('WAITING_FOR_WEB_APP_URL');
             responseText = "OK. Send me the URL that will be opened when users click on the Web App button.";
          } else if (cmd === '3') {
             setBotStep('IDLE');
             processBotFatherCommand('/mybots');
             return; // Avoid double sending
          } else {
             responseText = "Invalid option.";
          }
      }
      else if (botStep === 'WAITING_FOR_WEB_APP_URL') {
          if(selectedBot) {
              await localDB.users.update(selectedBot.uid, { webAppUrl: cmd.trim() });
              responseText = "Success! Web App URL updated. Use /start to see the main menu.";
              setBotStep('IDLE');
              setSelectedBot(null);
          }
      }
      else if (botStep === 'WAITING_FOR_NAME') {
          setTempBotName(cmd.trim());
          setBotStep('WAITING_FOR_USERNAME');
          responseText = "Good. Now let's choose a username for your bot. It must end in `bot`. Like this, for example: TetrisBot or tetris_bot.";
      }
      else if (botStep === 'WAITING_FOR_USERNAME') {
          const username = cmd.trim();
          const lowerUser = username.toLowerCase();
          
          if (lowerUser.includes(' ') || !lowerUser.endsWith('bot')) {
              responseText = "Sorry, the username must end in 'bot'. E.g. TetrisBot or tetris_bot.\n\nPlease try again.";
          } else {
              const existing = await localDB.users.search(lowerUser);
              const exists = existing.find(u => u.username === lowerUser);
              
              if (exists) {
                  responseText = "Sorry, this username is already taken. Please try something different.";
              } else {
                  const botId = `bot_${Date.now()}`;
                  const botToken = `712${Math.floor(Math.random()*10000)}:AAF${Math.random().toString(36).substring(7).toUpperCase()}_${Date.now().toString(36)}`;
                  
                  const newBot: User = {
                      uid: botId,
                      numericId: Date.now(),
                      username: lowerUser,
                      displayName: tempBotName,
                      isBot: true,
                      botToken: botToken,
                      inviterUid: user.uid,
                      avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${lowerUser}`,
                      typoloBalance: 0,
                      gifts: [],
                      joinedChannels: [],
                      archivedChats: [],
                      isAdmin: false,
                      presence: { isOnline: true, lastSeen: Date.now(), statusHidden: false },
                      sessions: [],
                      blockedUsers: [],
                      contacts: [],
                      inviteLink: `t.me/${lowerUser}`,
                      referralCount: 0,
                      privacy: { inactivityMonths: 12, lastSeen: 'everybody', forwarding: 'everybody' }
                  };
                  
                  await localDB.users.create(newBot);
                  setBotStep('IDLE');
                  setTempBotName('');
                  
                  responseText = `Done! Congratulations on your new bot. You will find it at t.me/${username}.

Use this token to access the HTTP API:
\`${botToken}\`

Keep your token secure and store it safely, it can be used by anyone to control your bot.`;
              }
          }
      }

      if (responseText) {
          setTimeout(async () => {
              const botMsg: Message = {
                  id: 'msg_bot_' + Date.now(),
                  senderId: 'bot_father_official',
                  senderName: 'BotFather',
                  type: 'text',
                  text: responseText,
                  status: 'sent',
                  timestamp: Date.now(),
                  localTimestamp: Date.now(),
                  seenBy: [],
                  isForwarded: false,
                  isDeleted: false,
                  editHistory: [],
                  reactions: []
              };
              await localDB.messages.send(chat.id, botMsg);
          }, 600);
      }
  };

  const handleAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const isVideo = file.type.startsWith('video/');
      const isImage = file.type.startsWith('image/');
      
      const reader = new FileReader();
      reader.onload = async () => {
          const base64 = reader.result as string;
          const msgData: Message = { 
            id: 'msg_media_' + Date.now(),
            senderId: user.uid, 
            senderName: user.displayName || user.username, 
            type: 'media',
            mediaUrl: base64,
            mediaType: isVideo ? 'video' : (isImage ? 'image' : 'file'),
            text: file.name, 
            status: 'sent', 
            timestamp: Date.now(), 
            localTimestamp: Date.now(), 
            seenBy: [user.uid], 
            isForwarded: false,
            isDeleted: false,
            editHistory: [],
            reactions: [] 
          };
          await localDB.messages.send(chat.id, msgData);
      };
      reader.readAsDataURL(file);
  };

  // --- VOICE RECORDING LOGIC ---
  const handleRecordToggle = async () => {
    if (isRecording) {
      mediaRecorder?.stop();
      setIsRecording(false);
      if(recordInterval.current) clearInterval(recordInterval.current);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        const chunks: Blob[] = [];

        recorder.ondataavailable = (e) => chunks.push(e.data);
        recorder.onstop = async () => {
           const blob = new Blob(chunks, { type: 'audio/webm' });
           const reader = new FileReader();
           reader.readAsDataURL(blob);
           reader.onloadend = async () => {
               const base64Audio = reader.result as string;
               const msgData: Message = { 
                  id: 'msg_audio_' + Date.now(),
                  senderId: user.uid, 
                  senderName: user.displayName || user.username, 
                  type: 'voice', 
                  audio: base64Audio,
                  status: 'sent', 
                  timestamp: Date.now(), 
                  localTimestamp: Date.now(), 
                  seenBy: [user.uid], 
                  isForwarded: false,
                  isDeleted: false,
                  editHistory: [],
                  reactions: [] 
               };
               await localDB.messages.send(chat.id, msgData);
           };
           stream.getTracks().forEach(t => t.stop());
        };

        recorder.start();
        setMediaRecorder(recorder);
        setAudioChunks([]);
        setIsRecording(true);
        setRecordingTime(0);
        recordInterval.current = window.setInterval(() => setRecordingTime(prev => prev + 1), 1000);

      } catch (err) {
        alert("Microphone access denied or not available.");
      }
    }
  };

  const handleAddEmoji = (emoji: string) => {
      setInputText(prev => prev + emoji);
  };

  const renderMessageText = (text: string) => {
    if (!text) return '';
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const mentionRegex = /(@\w+)/g;

    const parts = text.split(/((?:https?:\/\/[^\s]+)|(?:@\w+))/g);

    return parts.map((part, i) => {
      if (part.match(urlRegex)) {
        return <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline break-all" onClick={e => e.stopPropagation()}>{part}</a>;
      }
      if (part.match(mentionRegex)) {
        return <span key={i} onClick={(e) => { e.stopPropagation(); onMentionClick(part); }} className="text-blue-400 font-bold cursor-pointer hover:underline">{part}</span>;
      }
      return part;
    });
  };

  const formatTime = (seconds: number) => {
     const mins = Math.floor(seconds / 60);
     const secs = seconds % 60;
     return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleMessageAction = (action: 'reply' | 'pin' | 'delete' | 'copy' | 'archive') => {
      if(!longPressedMessage) return;
      
      switch(action) {
          case 'reply': setReplyTo(longPressedMessage); break;
          case 'pin': alert('Message pinned locally.'); break;
          case 'delete':
              if (longPressedMessage.senderId === user.uid) localDB.messages.delete(longPressedMessage.id);
              else alert("You can only delete your own messages.");
              break;
          case 'copy': if(longPressedMessage.text) navigator.clipboard.writeText(longPressedMessage.text); break;
          case 'archive': /* Logic handled elsewhere for chat archival, this is message action */ break;
      }
      setLongPressedMessage(null);
  };

  const handleOpenMiniApp = () => {
      if(peerUser?.webAppUrl) {
          window.dispatchEvent(new CustomEvent('open-mini-app', { detail: { url: peerUser.webAppUrl, title: peerUser.displayName } }));
      }
  };

  const badgeType = peerUser ? getUserBadge(peerUser.uid) : 'NONE';
  const chatDisplayName = peerUser?.displayName || chat.name || 'Conversation';
  const peerAvatar = peerUser?.avatar || chat.avatar;

  let statusText = 'Offline';
  if (peerUser) {
     if (peerUser.isBot) {
         statusText = 'Bot'; 
     } else if (peerUser.presence) {
        const diff = Date.now() - peerUser.presence.lastSeen;
        if (diff < 120000) { 
            statusText = 'online';
        } else {
            const date = new Date(peerUser.presence.lastSeen);
            statusText = `last seen ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
        }
     }
  }

  return (
    <>
    <div className="fixed inset-0 bg-[#0b141d] z-[120] flex flex-col slide-in font-sans rtl bg-[var(--winter-bg)]" dir="rtl">
      <div className="absolute inset-0 z-0 opacity-20 pointer-events-none bg-cover bg-center" 
           style={{ backgroundImage: user.chatBackground ? `url(${user.chatBackground})` : 'none' }} />
      <div className="absolute inset-0 bg-gradient-to-b from-blue-900/10 to-black/80 z-[1] pointer-events-none dark:to-black/80 to-white/10"></div>

      {/* HEADER */}
      <div className="thick-snow bg-[#15202b]/90 backdrop-blur-3xl text-white p-3 flex items-center gap-4 shadow-2xl h-16 z-10 border-b border-[var(--border-color)] dark:bg-[#15202b]/90 bg-white/90 dark:text-white text-gray-800">
        <button onClick={onBack} className="w-10 h-10 flex items-center justify-center active:scale-90 flex-shrink-0"><i className="fa-solid fa-arrow-right text-blue-400"></i></button>
        
        <div className="flex flex-1 items-center gap-3 cursor-pointer" onClick={() => setShowProfile(true)}>
            <div className="avatar-frame w-11 h-11 aspect-square rounded-full bg-gradient-to-br from-[#1c2833] to-[#24A1DE] border border-white/10 shadow-lg font-black overflow-hidden">
            {peerAvatar ? (
                <img src={peerAvatar} alt="" className="w-full h-full object-cover" />
            ) : (
                <span className="flex items-center justify-center w-full h-full">{chatDisplayName.charAt(0)}</span>
            )}
            </div>
            <div className="flex-1 min-w-0 text-right">
            <div className="flex items-center gap-1.5">
                <h2 className="font-black text-[15px] truncate dark:text-blue-50 text-gray-900">{chatDisplayName}</h2>
                {badgeType !== 'NONE' && <i className={`${getBadgeIcon(badgeType)} ${getBadgeStyle(badgeType)} text-[10px]`}></i>}
            </div>
            {chat.type === 'private' && (
                 <p className={`text-[10px] font-bold ${statusText === 'online' || statusText === 'Bot' ? 'text-blue-400' : 'text-gray-400'}`}>{statusText}</p>
            )}
            </div>
        </div>

        <div className="flex gap-2 flex-shrink-0">
            <button onClick={() => handleStartCall('audio')} className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 active:scale-90"><i className="fa-solid fa-phone text-blue-400 text-sm"></i></button>
            <button onClick={() => handleStartCall('video')} className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 active:scale-90"><i className="fa-solid fa-video text-blue-400 text-sm"></i></button>
        </div>
      </div>

      {/* MESSAGES */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4 pb-32 hide-scrollbar z-10 relative">
        {messages.map(msg => (
          <div key={msg.id} className={`flex flex-col ${msg.senderId === user.uid ? 'items-start' : 'items-end'}`}>
            <div 
                className={`max-w-[85%] rounded-[24px] px-4 py-3 shadow-2xl relative backdrop-blur-md border border-[var(--border-color)] transition-all active:scale-95 cursor-pointer ${
                msg.senderId === user.uid ? 'bg-blue-600/80 text-white rounded-br-none' : 'bg-white/10 dark:bg-white/5 dark:text-blue-100 text-gray-800 rounded-bl-none'
                }`}
                onContextMenu={(e) => { e.preventDefault(); setLongPressedMessage(msg); }}
            >
              {msg.replyToId && (
                  <div className="mb-2 border-r-2 border-white/50 pr-2 opacity-70 text-xs truncate">
                      <div className="font-bold">Replying to message...</div>
                  </div>
              )}

              {msg.type === 'voice' && msg.audio ? (
                  <AudioMessage audioSrc={msg.audio} isOwn={msg.senderId === user.uid} />
              ) : msg.type === 'media' && msg.mediaUrl ? (
                  <div className="flex flex-col gap-2">
                      {msg.mediaType === 'image' && (
                          <img src={msg.mediaUrl} className="rounded-xl max-w-full max-h-64 object-cover cursor-pointer hover:opacity-90 transition-opacity" />
                      )}
                      {msg.mediaType === 'video' && (
                          <video src={msg.mediaUrl} controls className="rounded-xl max-w-full max-h-64 bg-black" />
                      )}
                      {msg.text && <div className="text-[12px] opacity-80 mt-1">{msg.text}</div>}
                  </div>
              ) : (
                  <div className={`text-[14px] leading-relaxed break-words font-medium whitespace-pre-wrap ${msg.senderId !== user.uid ? 'text-white' : ''}`}>
                    {msg.text ? renderMessageText(msg.text) : ''}
                  </div>
              )}
              
              <div className="text-[8px] font-black mt-2 opacity-40 text-left flex justify-end gap-1 items-center">
                 {msg.senderId === user.uid && <i className="fa-solid fa-check text-[10px]"></i>}
                 {msg.localTimestamp ? new Date(msg.localTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
              </div>
            </div>

            {/* Mini App Button for Bot Messages */}
            {msg.senderId !== user.uid && peerUser?.isBot && peerUser.webAppUrl && (
                <button onClick={handleOpenMiniApp} className="mt-2 bg-white/10 backdrop-blur-md border border-white/20 text-[#24A1DE] px-4 py-2 rounded-xl text-xs font-bold w-[85%] flex items-center justify-center gap-2 hover:bg-white/20 transition-colors">
                    <i className="fa-solid fa-window-maximize"></i> Open {peerUser.displayName} Mini App
                </button>
            )}
          </div>
        ))}
      </div>

      {/* MESSAGE CONTEXT MENU */}
      {longPressedMessage && (
          <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center animate-fade-in" onClick={() => setLongPressedMessage(null)}>
              <div className="bg-[#1c1c1e] rounded-2xl w-64 p-2 shadow-2xl border border-white/10" onClick={e => e.stopPropagation()}>
                  <div className="p-3 border-b border-white/10 mb-2">
                      <p className="text-white text-xs truncate opacity-70">{longPressedMessage.text || 'Media Message'}</p>
                  </div>
                  <button onClick={() => handleMessageAction('reply')} className="w-full flex items-center gap-3 p-3 hover:bg-white/5 rounded-lg text-white text-sm font-bold"><i className="fa-solid fa-reply text-blue-400"></i> Reply</button>
                  <button onClick={() => handleMessageAction('copy')} className="w-full flex items-center gap-3 p-3 hover:bg-white/5 rounded-lg text-white text-sm font-bold"><i className="fa-regular fa-copy text-green-400"></i> Copy</button>
                  <button onClick={() => handleMessageAction('pin')} className="w-full flex items-center gap-3 p-3 hover:bg-white/5 rounded-lg text-white text-sm font-bold"><i className="fa-solid fa-thumbtack text-yellow-400"></i> Pin</button>
                  {longPressedMessage.senderId === user.uid && (
                      <button onClick={() => handleMessageAction('delete')} className="w-full flex items-center gap-3 p-3 hover:bg-red-500/10 rounded-lg text-red-400 text-sm font-bold"><i className="fa-solid fa-trash"></i> Delete</button>
                  )}
              </div>
          </div>
      )}

      {/* Emoji Picker */}
      {showEmojiPicker && (
          <div className="absolute bottom-24 left-4 right-4 h-48 bg-[#15202b]/95 backdrop-blur-xl rounded-[24px] z-30 border border-white/10 p-3 shadow-2xl animate-fade-in grid grid-cols-6 gap-2 overflow-y-auto hide-scrollbar">
              {EMOJI_LIST.map(e => (
                  <button key={e} onClick={() => handleAddEmoji(e)} className="text-2xl hover:bg-white/10 rounded-lg p-2 active:scale-90 transition-transform">{e}</button>
              ))}
          </div>
      )}

      {/* REPLY INDICATOR */}
      {replyTo && (
          <div className="absolute bottom-[90px] left-4 right-4 bg-[#1c1c1e]/90 backdrop-blur-md p-2 rounded-xl flex justify-between items-center z-20 border-l-4 border-blue-500">
              <div className="flex flex-col ml-2 overflow-hidden">
                  <span className="text-[10px] text-blue-400 font-bold">Replying to {replyTo.senderName}</span>
                  <span className="text-xs text-white truncate">{replyTo.text || 'Media'}</span>
              </div>
              <button onClick={() => setReplyTo(null)}><i className="fa-solid fa-xmark text-gray-400 p-2"></i></button>
          </div>
      )}

      {/* NEW GLASS INPUT BAR DESIGN - FIXED PADDING & OVERFLOW */}
      <div className="absolute bottom-0 w-full px-3 z-20 flex items-end gap-2 pb-6 safe-area-bottom pt-4 bg-gradient-to-t from-black/80 to-transparent">
        
        {/* Main Input Capsule */}
        <div className="flex-1 bg-[#1c1c1e]/80 dark:bg-[#1c1c1e]/80 bg-white/80 backdrop-blur-xl rounded-[26px] flex items-center p-1.5 border border-[var(--border-color)] shadow-lg min-h-[50px]">
            <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="w-10 h-10 rounded-full text-gray-400 hover:text-blue-500 transition-colors flex items-center justify-center active:scale-90 flex-shrink-0">
                <i className="fa-regular fa-face-smile text-2xl"></i>
            </button>

            <textarea 
                className="flex-1 bg-transparent px-2 text-[15px] outline-none text-[var(--text-primary)] text-right font-medium placeholder-gray-500 max-h-24 resize-none py-3 hide-scrollbar" 
                placeholder={isRecording ? "Recording..." : "Message"}
                value={inputText} 
                rows={1}
                onChange={(e) => setInputText(e.target.value)} 
                onKeyPress={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendText(); } }} 
                disabled={isRecording}
                dir="auto"
            />

            <input type="file" ref={fileInputRef} className="hidden" onChange={handleAttachment} accept="image/*,video/*" />

            <button onClick={() => fileInputRef.current?.click()} className="w-10 h-10 rounded-full text-gray-400 hover:text-blue-500 transition-colors flex items-center justify-center active:scale-90 flex-shrink-0 transform -rotate-45">
                <i className="fa-solid fa-paperclip text-xl"></i>
            </button>

            {!inputText && (
                <button onClick={() => fileInputRef.current?.click()} className="w-10 h-10 rounded-full text-gray-400 hover:text-blue-500 transition-colors flex items-center justify-center active:scale-90 flex-shrink-0">
                    <i className="fa-solid fa-camera text-xl"></i>
                </button>
            )}
        </div>

        {/* Send/Mic Button Circle - FIXED ALIGNMENT */}
        <div className="flex-shrink-0 w-[50px] h-[50px]">
            {inputText.trim() ? (
                <button onClick={handleSendText} className="w-full h-full rounded-full bg-[#24A1DE] text-white shadow-xl flex items-center justify-center active:scale-90 transition-transform animate-pop-in">
                    <i className="fa-solid fa-paper-plane text-xl pr-1"></i> 
                </button>
            ) : (
                <button 
                    onClick={handleRecordToggle} 
                    className={`w-full h-full rounded-full shadow-xl flex items-center justify-center active:scale-90 transition-all ${isRecording ? 'bg-red-500 animate-pulse scale-110' : 'bg-[#1c1c1e]/80 dark:bg-[#1c1c1e]/80 bg-white/80 backdrop-blur-xl border border-[var(--border-color)] text-blue-500'}`}
                >
                    {isRecording ? (
                        <div className="flex flex-col items-center justify-center h-full">
                            <i className="fa-solid fa-stop text-white"></i>
                            <span className="text-[8px] font-black mt-0.5">{formatTime(recordingTime)}</span>
                        </div>
                    ) : (
                        <i className="fa-solid fa-microphone text-xl"></i>
                    )}
                </button>
            )}
        </div>
      </div>
    </div>
    
    {peerUser && <UserProfileModal isOpen={showProfile} onClose={() => setShowProfile(false)} user={peerUser} />}
    </>
  );
};

const AudioMessage = ({ audioSrc, isOwn }: { audioSrc: string, isOwn: boolean }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = useRef<HTMLAudioElement>(null);

    const togglePlay = () => {
        if(audioRef.current) {
            if(isPlaying) audioRef.current.pause();
            else audioRef.current.play();
            setIsPlaying(!isPlaying);
        }
    };

    return (
        <div className="flex items-center gap-3 min-w-[200px]">
            <button onClick={togglePlay} className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-90 ${isOwn ? 'bg-white text-blue-500' : 'bg-blue-500 text-white'}`}>
                <i className={`fa-solid ${isPlaying ? 'fa-pause' : 'fa-play pl-1'}`}></i>
            </button>
            <div className="flex flex-col flex-1 gap-1">
                <div className="h-8 flex items-center gap-[2px] opacity-70">
                    {Array.from({length: 20}).map((_, i) => (
                        <div key={i} className={`w-1 rounded-full bg-current transition-all duration-300 ${isPlaying ? 'animate-pulse' : ''}`} style={{ height: `${Math.random() * 100}%` }}></div>
                    ))}
                </div>
                <div className="text-[10px] font-mono opacity-60">Voice Message</div>
            </div>
            <audio ref={audioRef} src={audioSrc} onEnded={() => setIsPlaying(false)} className="hidden" />
        </div>
    );
};

export default ChatView;
