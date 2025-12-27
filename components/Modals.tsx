
import React, { useState, useRef, useEffect } from 'react';
import { User, Chat, LiveStream, StreamMessage } from '../types';
import { db as localDB } from '../firebase';
import { APP_GIFTS, GiftItem } from '../GiftsData';
import { getUserBadge } from '../VerifiedUsers';
import { getBadgeIcon, getBadgeStyle } from '../SupportDB';

// --- Helper for Image Compression ---
const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 500; 
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
        } else {
          if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
    };
  });
};

interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  transparent?: boolean;
}

const BaseModal: React.FC<BaseModalProps> = ({ isOpen, onClose, title, children, transparent }) => {
  if (!isOpen) return null;
  return (
    <div className={`fixed inset-0 z-[300] flex items-center justify-center p-0 animate-fade-in ${transparent ? 'bg-black/60 backdrop-blur-md' : 'bg-black/80'}`} onClick={onClose}>
      <div className={`${transparent ? 'bg-[#1c1c1e] border border-white/10' : 'bg-[#1c1c1e]'} w-full max-w-lg h-full sm:h-auto sm:max-h-[95vh] sm:rounded-[24px] shadow-2xl flex flex-col overflow-hidden transition-all`} onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 flex items-center justify-between bg-[#1c1c1e] z-10 border-b border-white/5">
          <button onClick={onClose} className="text-gray-400 text-xl w-8 h-8 flex items-center justify-center rounded-full active:bg-white/10"><i className="fa-solid fa-xmark"></i></button>
          <h3 className="text-[17px] font-bold text-white">{title}</h3>
          <div className="w-8"></div>
        </div>
        <div className="flex-1 overflow-y-auto hide-scrollbar relative bg-[#000]">
          {children}
        </div>
      </div>
    </div>
  );
};

// --- MINI APP MODAL ---
export const MiniAppModal = ({ isOpen, onClose, url, title }: { isOpen: boolean, onClose: () => void, url: string, title: string }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex flex-col justify-end animate-slide-in">
            <div className="bg-white h-[85vh] w-full rounded-t-[24px] overflow-hidden flex flex-col shadow-2xl">
                {/* Header */}
                <div className="bg-white px-4 py-3 border-b flex justify-between items-center z-10">
                    <button onClick={onClose} className="text-[#24A1DE] font-bold text-sm">Close</button>
                    <div className="flex flex-col items-center">
                        <span className="font-black text-black text-sm">{title}</span>
                        <span className="text-[10px] text-gray-400">Mini App</span>
                    </div>
                    <button className="text-gray-400"><i className="fa-solid fa-ellipsis"></i></button>
                </div>
                {/* Content */}
                <div className="flex-1 bg-gray-100 relative">
                     {url ? (
                         <iframe src={url} className="w-full h-full border-0" title="Mini App" allow="camera; microphone; geolocation" />
                     ) : (
                         <div className="flex items-center justify-center h-full text-gray-400">Invalid URL</div>
                     )}
                </div>
            </div>
        </div>
    );
};

// --- PRIVACY MODAL ---
export const PrivacyModal = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
    return (
        <BaseModal isOpen={isOpen} onClose={onClose} title="حریم خصوصی و امنیت">
            <div className="p-6 text-right rtl bg-[#121212] min-h-full" dir="rtl">
                <div className="flex justify-center mb-6">
                    <div className="w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center animate-pulse">
                        <i className="fa-solid fa-shield-halved text-5xl text-emerald-500"></i>
                    </div>
                </div>
                
                <h2 className="text-xl font-black text-white mb-4 text-center">امنیت شما، اولویت ماست</h2>
                
                <div className="space-y-6 text-gray-300 text-sm leading-7">
                    <div className="bg-[#1c1c1e] p-4 rounded-xl border border-white/5">
                        <h3 className="text-emerald-400 font-bold mb-2 flex items-center gap-2"><i className="fa-solid fa-lock"></i> رمزنگاری سرتاسری</h3>
                        <p>تمامی پیام‌ها، تماس‌ها و مدیاهای شما با استفاده از پروتکل‌های پیشرفته رمزنگاری می‌شوند. هیچ شخص ثالثی، حتی سرورهای ما، قادر به خواندن پیام‌های شما نیست.</p>
                    </div>

                    <div className="bg-[#1c1c1e] p-4 rounded-xl border border-white/5">
                        <h3 className="text-blue-400 font-bold mb-2 flex items-center gap-2"><i className="fa-solid fa-server"></i> ذخیره‌سازی ابری امن</h3>
                        <p>داده‌های شما در دیتاسنترهای توزیع شده با بالاترین سطح امنیتی نگهداری می‌شوند. ما هیچ دیتایی را به شرکت‌های تبلیغاتی نمی‌فروشیم.</p>
                    </div>

                    <div className="bg-[#1c1c1e] p-4 rounded-xl border border-white/5">
                        <h3 className="text-yellow-400 font-bold mb-2 flex items-center gap-2"><i className="fa-solid fa-user-secret"></i> ناشناس ماندن</h3>
                        <p>شما می‌توانید هویت خود را کاملاً مخفی نگه دارید. شماره تماس شما برای دیگران نمایش داده نمی‌شود مگر اینکه خودتان بخواهید.</p>
                    </div>

                    <p className="text-xs text-gray-500 text-center mt-8">
                        آخرین بروزرسانی: ۲۴ آذر ۱۴۰۲<br/>
                        نسخه قوانین: 3.5.2 (Alpha Secure)
                    </p>
                </div>
            </div>
        </BaseModal>
    );
};

export const StreamModal = ({ isOpen, onClose, user, stream }: { isOpen: boolean, onClose: () => void, user: User, stream: LiveStream }) => {
    const [msgText, setMsgText] = useState('');
    const [localVideo, setLocalVideo] = useState<MediaStream | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null); 
    const mainVideoRef = useRef<HTMLVideoElement>(null); 
    const [hasRequested, setHasRequested] = useState(false);

    const isHost = user.uid === stream.hostId;
    const isGuest = user.uid === stream.guestId;

    useEffect(() => {
        if (isHost || isGuest) {
            navigator.mediaDevices.getUserMedia({ video: true, audio: true })
                .then(stream => {
                    setLocalVideo(stream);
                    if (isGuest && videoRef.current) videoRef.current.srcObject = stream;
                    if (isHost && mainVideoRef.current) mainVideoRef.current.srcObject = stream;
                });
        }
        return () => {
             if (localVideo) localVideo.getTracks().forEach(t => t.stop());
        };
    }, [isHost, isGuest]);

    const handleSend = async () => {
        if(!msgText.trim()) return;
        const msg: StreamMessage = {
            id: `sm_${Date.now()}`,
            userId: user.uid,
            username: user.displayName,
            text: msgText,
            isDonation: false,
            timestamp: Date.now()
        };
        await localDB.stream.addMessage(msg);
        setMsgText('');
    };

    const handleDonate = async () => {
        if(user.typoloBalance < 100) return alert('Need 100 Typolo!');
        await localDB.users.update(user.uid, { typoloBalance: user.typoloBalance - 100 });
        const msg: StreamMessage = {
            id: `sm_${Date.now()}`,
            userId: user.uid,
            username: user.displayName,
            text: 'Gifted 100 Typolo! ❤️',
            isDonation: true,
            amount: 100,
            timestamp: Date.now()
        };
        await localDB.stream.addMessage(msg);
    };

    const handleRequestJoin = async () => {
        setHasRequested(true);
        await localDB.stream.addRequest({ userId: user.uid, username: user.displayName, avatar: user.avatar || '' });
    };

    if(!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[500] bg-black flex flex-col font-sans">
             <div className="relative flex-1 bg-[#121212] overflow-hidden">
                 {isHost ? (
                     <video ref={mainVideoRef} autoPlay muted playsInline className="absolute inset-0 w-full h-full object-cover" />
                 ) : (
                     <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                         <div className="text-center opacity-50">
                             <i className="fa-solid fa-tower-broadcast text-6xl mb-4 animate-pulse text-red-500"></i>
                             <p>Host Feed Incoming...</p>
                         </div>
                         <video 
                            src="https://assets.mixkit.co/videos/preview/mixkit-waves-coming-to-the-beach-5016-large.mp4" 
                            autoPlay loop muted playsInline 
                            className="absolute inset-0 w-full h-full object-cover opacity-80" 
                         />
                     </div>
                 )}
                 
                 <div className="absolute top-4 left-4 right-4 flex justify-between items-start z-20">
                     <div className="bg-red-600 text-white px-3 py-1 rounded-lg text-xs font-black uppercase shadow-lg animate-pulse">LIVE</div>
                     <div className="bg-black/50 backdrop-blur-md px-3 py-1 rounded-lg text-xs font-bold text-white flex items-center gap-2">
                         <i className="fa-solid fa-eye"></i> {stream.viewersCount || 1}
                     </div>
                     <button onClick={onClose} className="w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center"><i className="fa-solid fa-xmark"></i></button>
                 </div>

                 {(stream.guestId) && (
                     <div className="absolute top-20 right-4 w-32 h-48 bg-black rounded-xl border-2 border-white/20 overflow-hidden shadow-2xl z-30">
                         {isGuest ? (
                             <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover transform scale-x-[-1]" />
                         ) : (
                             <div className="w-full h-full bg-gray-800 flex items-center justify-center text-xs text-white flex-col gap-2">
                                 <div className="w-8 h-8 rounded-full bg-white/20 animate-pulse"></div>
                                 <span>Guest Cam</span>
                             </div>
                         )}
                         <div className="absolute bottom-0 w-full bg-black/50 text-[10px] text-white text-center py-1">
                             {stream.guestName || 'Guest'}
                         </div>
                     </div>
                 )}

                 {!isHost && !isGuest && !hasRequested && (
                     <div className="absolute bottom-4 left-4 z-30">
                         <button onClick={handleRequestJoin} className="bg-blue-600/80 backdrop-blur text-white px-4 py-2 rounded-full text-xs font-bold shadow-lg flex items-center gap-2 active:scale-95 transition-transform">
                             <i className="fa-solid fa-video"></i> Request to Join
                         </button>
                     </div>
                 )}
                 {!isHost && !isGuest && hasRequested && (
                     <div className="absolute bottom-4 left-4 z-30">
                         <button disabled className="bg-white/20 backdrop-blur text-white px-4 py-2 rounded-full text-xs font-bold shadow-lg flex items-center gap-2">
                             <i className="fa-solid fa-clock"></i> Requested
                         </button>
                     </div>
                 )}
             </div>

             <div className="h-1/3 bg-black/80 backdrop-blur-md flex flex-col absolute bottom-0 w-full">
                 <div className="flex-1 overflow-y-auto p-4 space-y-2 mask-linear-fade">
                     {stream.messages.map(m => (
                         <div key={m.id} className={`text-sm ${m.isDonation ? 'bg-yellow-500/20 border border-yellow-500/50 p-2 rounded-lg' : ''}`}>
                             <span className={`font-bold ${m.isDonation ? 'text-yellow-400' : 'text-blue-400'}`}>{m.username}: </span>
                             <span className="text-white">{m.text}</span>
                         </div>
                     ))}
                 </div>

                 <div className="p-3 border-t border-white/10 flex gap-2 items-center">
                     <input 
                        className="flex-1 bg-white/10 rounded-full px-4 py-2 text-white outline-none text-sm placeholder-gray-500"
                        placeholder="Say something..."
                        value={msgText}
                        onChange={e => setMsgText(e.target.value)}
                        onKeyPress={e => e.key === 'Enter' && handleSend()}
                     />
                     <button onClick={handleDonate} className="w-10 h-10 rounded-full bg-yellow-500 flex items-center justify-center text-black shadow-lg active:scale-95 transition-transform">
                         <i className="fa-solid fa-gift"></i>
                     </button>
                     <button onClick={handleSend} className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white shadow-lg active:scale-95 transition-transform">
                         <i className="fa-solid fa-paper-plane"></i>
                     </button>
                 </div>
             </div>
        </div>
    );
};

export const UserProfileModal = ({ isOpen, onClose, user }: { isOpen: boolean, onClose: () => void, user: User }) => {
    if(!isOpen) return null;

    const badgeType = getUserBadge(user.uid);
    const lastSeenTime = new Date(user.presence.lastSeen);
    const isOnline = (Date.now() - user.presence.lastSeen) < 120000; 

    return (
        <div className="fixed inset-0 z-[400] bg-black flex flex-col animate-slide-in font-sans rtl" dir="rtl">
            <div className="relative h-[45vh] w-full bg-gray-800">
                <img 
                    src={user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`} 
                    className="w-full h-full object-cover" 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-90"></div>
                
                <button onClick={onClose} className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center bg-black/40 rounded-full text-white backdrop-blur-md z-20">
                    <i className="fa-solid fa-arrow-right"></i>
                </button>

                <div className="absolute bottom-6 right-6 z-10 text-white">
                    <div className="flex items-center gap-2">
                        <h1 className="text-3xl font-black drop-shadow-md">{user.displayName}</h1>
                        {badgeType !== 'NONE' && <i className={`${getBadgeIcon(badgeType)} ${getBadgeStyle(badgeType)} text-lg`}></i>}
                    </div>
                    {user.isBot ? (
                        <p className="text-blue-400 font-bold mt-1">Bot</p>
                    ) : (
                        <p className="text-white/80 font-medium drop-shadow-md mt-1">
                            {isOnline ? 'online' : `last seen ${lastSeenTime.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`}
                        </p>
                    )}
                </div>
            </div>

            <div className="flex-1 bg-[#1c1c1e] -mt-4 rounded-t-[30px] relative z-10 p-6 space-y-6 overflow-y-auto">
                <div className="space-y-6">
                    <div className="flex items-start gap-4 pb-4 border-b border-white/5">
                        <div className="w-6 mt-1 text-center"><i className="fa-solid fa-circle-info text-gray-500 text-lg"></i></div>
                        <div>
                             <div className="text-white text-[15px] leading-relaxed">{user.bio || 'Empty bio'}</div>
                             <div className="text-[11px] text-gray-500 mt-1">Bio</div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 pb-4 border-b border-white/5">
                        <div className="w-6 text-center"><i className="fa-solid fa-at text-gray-500 text-lg"></i></div>
                        <div>
                             <div className="text-white text-[15px]">@{user.username}</div>
                             <div className="text-[11px] text-gray-500 mt-1">Username</div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-4">
                    <button className="bg-blue-500/20 text-blue-400 py-3 rounded-xl font-bold text-sm">Send Message</button>
                    <button className="bg-red-500/20 text-red-400 py-3 rounded-xl font-bold text-sm">Block User</button>
                </div>
            </div>
        </div>
    );
};

export const BackgroundPickerModal = ({ isOpen, onClose, onSelect }: { isOpen: boolean, onClose: () => void, onSelect: (bg: string) => void }) => {
  const [tempBg, setTempBg] = useState<string>('');
  const bgs = [
    'https://images.unsplash.com/photo-1557683316-973673baf926',
    'https://images.unsplash.com/photo-1554034483-04fda0d3507b',
    'https://images.unsplash.com/photo-1579546929518-9e396f3cc809',
    'https://images.unsplash.com/photo-1519750783846-e33554d79805',
    'https://images.unsplash.com/photo-1506744038136-46273834b3fb',
    'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e'
  ];

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="Choose Wallpaper">
      <div className="flex flex-col h-full bg-[#0b141d]">
        <div className="relative h-80 w-full bg-[#1c2833] flex flex-col justify-end overflow-hidden">
           <div className="absolute inset-0 bg-cover bg-center transition-all duration-500 ease-out" style={{ backgroundImage: tempBg ? `url(${tempBg})` : 'none' }}></div>
           <div className="absolute inset-0 bg-black/20"></div>
           
           <div className="relative z-10 p-4 space-y-2">
               <div className="self-start bg-white/10 text-white p-3 rounded-2xl rounded-bl-none max-w-[80%] backdrop-blur-md">
                   Looks amazing! ❄️
               </div>
               <div className="self-end bg-[#24A1DE] text-white p-3 rounded-2xl rounded-br-none max-w-[80%] ml-auto shadow-lg">
                   I love this new background.
               </div>
           </div>
        </div>

        <div className="p-4 bg-[#1c1c1e] flex-1 rounded-t-3xl -mt-4 relative z-20 shadow-2xl">
          <div className="text-gray-400 text-xs font-bold uppercase mb-3">Presets</div>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {bgs.map((bg, idx) => (
              <div key={idx} onClick={() => setTempBg(bg)} className={`aspect-[1/1] rounded-xl bg-cover bg-center cursor-pointer border-2 transition-all active:scale-95 ${tempBg === bg ? 'border-[#24A1DE] scale-105' : 'border-transparent opacity-70 hover:opacity-100'}`} style={{ backgroundImage: `url(${bg})` }} />
            ))}
            <div onClick={() => setTempBg('')} className="aspect-[1/1] rounded-xl bg-black flex flex-col items-center justify-center cursor-pointer border-2 border-white/10 text-xs text-gray-400 font-bold hover:bg-white/5">
                <i className="fa-solid fa-ban text-lg mb-1"></i>
                Reset
            </div>
          </div>
          <button onClick={() => { onSelect(tempBg); onClose(); }} className="w-full py-4 bg-[#24A1DE] text-white rounded-xl font-bold text-lg shadow-lg active:scale-95 transition-transform">
             Set Background
          </button>
        </div>
      </div>
    </BaseModal>
  );
};

export const ProfileModal = ({ isOpen, onClose, user, onSave }: { isOpen: boolean, onClose: () => void, user: User, onSave: (data: Partial<User>) => void }) => {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [username, setUsername] = useState(user.username);
  const [bio, setBio] = useState(user.bio || '');
  const [birthDate, setBirthDate] = useState(user.birthDate || '');
  const [avatar, setAvatar] = useState(user.avatar);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpdate = () => {
    if (isProcessing) return;
    onSave({ displayName, avatar, username: username.toLowerCase().trim(), bio, birthDate });
    onClose();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) {
          setIsProcessing(true);
          try {
              const compressed = await compressImage(f);
              setAvatar(compressed);
          } catch (err) {
              alert("Error loading image. Try another one.");
          } finally {
              setIsProcessing(false);
          }
      }
  };

  const copyUid = () => {
      if (navigator.clipboard) {
          navigator.clipboard.writeText(user.uid);
          alert('ID Copied!');
      }
  };

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="Identity" transparent>
      <div className="bg-[#1c1c1e] h-full flex flex-col">
        <div className="relative h-32 w-full bg-gradient-to-r from-[#24A1DE] via-[#9F7AEA] to-[#ED64A6]">
            <div className="absolute inset-0 bg-black/20"></div>
            <div className="absolute -bottom-10 left-6">
                 <div onClick={() => fileRef.current?.click()} className="relative w-24 h-24 rounded-full bg-[#1c1c1e] p-1 cursor-pointer group">
                    <div className="w-full h-full rounded-full overflow-hidden border-2 border-[#1c1c1e] relative">
                        <img src={avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`} className="w-full h-full object-cover group-hover:opacity-60 transition-all" />
                        {isProcessing && <div className="absolute inset-0 flex items-center justify-center bg-black/50"><i className="fa-solid fa-spinner animate-spin text-white"></i></div>}
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                         <i className="fa-solid fa-camera text-white drop-shadow-lg"></i>
                    </div>
                 </div>
                 <input type="file" ref={fileRef} className="hidden" accept="image/*" onChange={handleFileChange} />
            </div>
        </div>

        <div className="mt-12 px-6 flex-1 overflow-y-auto hide-scrollbar pb-10">
            <div className="flex justify-between items-start mb-6">
                <div>
                     <input 
                       className="bg-transparent text-2xl font-black text-white outline-none placeholder-gray-600 w-full"
                       value={displayName} 
                       onChange={e => setDisplayName(e.target.value)}
                       placeholder="Display Name"
                     />
                     <div className="flex items-center gap-1 mt-1">
                        <span className="text-gray-500 font-bold text-sm">@</span>
                        <input 
                            className="bg-transparent text-sm font-bold text-blue-400 outline-none placeholder-gray-600"
                            value={username} 
                            onChange={e => setUsername(e.target.value)}
                            placeholder="username"
                        />
                     </div>
                </div>
                <div className="bg-white/5 rounded-lg px-2 py-1 flex items-center gap-1 border border-white/5">
                     <span className="text-[10px] text-gray-400 font-mono">UID</span>
                     <span className="text-[10px] text-white font-mono">{user.numericId}</span>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-[#252527] p-4 rounded-2xl border border-white/5">
                    <div className="text-gray-500 text-[10px] font-black uppercase mb-1">Status</div>
                    <div className="text-white font-bold text-sm flex items-center gap-2">
                         <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_5px_#22c55e]"></span> Online
                    </div>
                </div>
                <div className="bg-[#252527] p-4 rounded-2xl border border-white/5">
                    <div className="text-gray-500 text-[10px] font-black uppercase mb-1">Balance</div>
                    <div className="text-yellow-500 font-black text-sm">{user.typoloBalance} Stars</div>
                </div>
            </div>

            <div className="space-y-4 mb-6">
                 <div>
                    <label className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-2 block">About Me</label>
                    <textarea 
                        className="w-full bg-[#252527] rounded-xl p-4 text-white text-sm outline-none border border-white/5 focus:border-[#24A1DE]/50 transition-colors resize-none h-20"
                        placeholder="Write a few words about yourself..."
                        value={bio}
                        onChange={e => setBio(e.target.value)}
                    />
                 </div>
                 
                 <div>
                    <label className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-2 block">Date of Birth</label>
                    <input 
                        type="date"
                        className="w-full bg-[#252527] rounded-xl p-4 text-white text-sm outline-none border border-white/5 focus:border-[#24A1DE]/50 transition-colors"
                        value={birthDate}
                        onChange={e => setBirthDate(e.target.value)}
                    />
                 </div>
            </div>

            <div className="bg-[#252527] rounded-xl p-4 flex items-center justify-between border border-white/5 mb-6 group cursor-pointer hover:bg-[#2a2a2d] transition-colors" onClick={copyUid}>
                <div>
                     <div className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Universal ID</div>
                     <div className="font-mono text-xs text-gray-300 mt-1 truncate max-w-[200px]">{user.uid}</div>
                </div>
                <i className="fa-regular fa-copy text-gray-500 group-hover:text-white transition-colors"></i>
            </div>

            <button onClick={handleUpdate} className="w-full py-4 bg-gradient-to-r from-[#24A1DE] to-[#9F7AEA] text-white rounded-xl font-bold shadow-lg active:scale-95 transition-transform">
                Save Profile
            </button>
        </div>
      </div>
    </BaseModal>
  );
};

export const GiftsModal = ({ isOpen, onClose, user, onUpdateUser }: { isOpen: boolean, onClose: () => void, user: User, onUpdateUser: (data: Partial<User>) => void }) => {
  const handleBuy = async (gift: GiftItem) => {
    if (user.typoloBalance < gift.price) return alert('Not enough Stars!');
    const newGifts = [...(user.gifts || []), { id: gift.id, name: gift.name, price: gift.price, emoji: gift.emoji, rarity: gift.rarity }];
    onUpdateUser({ typoloBalance: user.typoloBalance - gift.price, gifts: newGifts });
  };

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="Star Store">
      <div className="bg-[#1c1c1e] min-h-full pb-10">
        <div className="bg-[#2c2c2e] m-4 p-4 rounded-2xl flex items-center justify-between border border-white/5">
            <div className="flex flex-col">
                <span className="text-gray-400 text-xs font-bold uppercase">Your Balance</span>
                <div className="flex items-center gap-2">
                    <span className="text-white font-black text-2xl">{user.typoloBalance.toLocaleString()}</span>
                    <i className="fa-solid fa-star text-yellow-500 text-lg"></i>
                </div>
            </div>
            <button className="bg-yellow-500/20 text-yellow-500 px-4 py-2 rounded-xl text-xs font-black uppercase">Buy Stars</button>
        </div>

        <div className="px-4 pb-4 grid grid-cols-2 gap-3">
            {APP_GIFTS.map(gift => (
            <div key={gift.id} className="bg-[#252527] rounded-2xl p-4 flex flex-col items-center gap-4 relative overflow-hidden group border border-white/5 hover:border-yellow-500/50 transition-all">
                <div className={`absolute top-0 left-0 right-0 h-16 bg-gradient-to-b ${gift.gradient} opacity-20 blur-xl`}></div>
                <div className={`relative z-10 text-5xl drop-shadow-2xl mt-2 transition-transform duration-300 group-hover:scale-110 ${gift.effect}`}>
                    {gift.emoji}
                </div>
                <div className="text-center z-10 w-full">
                    <h4 className="text-white font-bold text-sm truncate">{gift.name}</h4>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase mt-1 inline-block ${gift.rarity === 'Legendary' ? 'bg-yellow-500 text-black' : 'bg-white/10 text-gray-400'}`}>
                        {gift.rarity}
                    </span>
                </div>
                <button 
                    onClick={() => handleBuy(gift)}
                    className="w-full py-2.5 bg-yellow-500 hover:bg-yellow-400 text-black rounded-xl text-sm font-black flex items-center justify-center gap-1.5 z-10 shadow-lg active:scale-95 transition-transform"
                >
                    <i className="fa-solid fa-star text-[10px]"></i>
                    {gift.price}
                </button>
            </div>
            ))}
        </div>
      </div>
    </BaseModal>
  );
};

export const InvitesModal = ({ isOpen, onClose, user, onStartChat }: { isOpen: boolean, onClose: () => void, user: User, onStartChat: (c: Chat) => void }) => {
  const copyLink = () => {
    const link = user.inviteLink;
    if (navigator.clipboard) navigator.clipboard.writeText(link);
    alert('Link Copied');
  };
  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="Invite Friends">
      <div className="p-8 bg-[#1c1c1e] flex flex-col items-center text-center space-y-6">
        <div className="w-24 h-24 bg-blue-500/10 rounded-full flex items-center justify-center animate-bounce-slow">
            <i className="fa-solid fa-paper-plane text-4xl text-blue-500"></i>
        </div>
        <div>
            <h3 className="text-white font-bold text-xl">Invite & Earn Stars</h3>
            <p className="text-gray-500 text-sm mt-2">Get 100 Stars for every friend who joins via your link.</p>
        </div>
        <div className="w-full bg-[#2c2c2e] p-4 rounded-xl text-blue-400 font-mono text-xs break-all cursor-pointer hover:bg-white/10" onClick={copyLink}>
            {user.inviteLink}
        </div>
        <button onClick={copyLink} className="w-full py-3 bg-blue-500 text-white rounded-xl font-bold">Copy Link</button>
      </div>
    </BaseModal>
  );
};

export const CreateChatModal = ({ isOpen, onClose, user, onCreated }: { isOpen: boolean, onClose: () => void, user: User, onCreated: (c: Chat) => void }) => {
  const [name, setName] = useState('');
  const [membersInput, setMembersInput] = useState('');
  
  const handleCreate = async () => {
    if (!name.trim()) return;
    
    // Parse members
    const usernames = membersInput.split(/[\s,]+/).filter(s => s.startsWith('@')).map(s => s.replace('@', '').toLowerCase());
    const memberIds = [user.uid]; // Admin is first member
    
    // Find users
    if (usernames.length > 0) {
        const allUsers = await localDB.users.search('');
        usernames.forEach(uName => {
            const found = allUsers.find(u => u.username === uName);
            if (found) memberIds.push(found.uid);
        });
    }

    const chatId = `group_${Date.now()}`;
    const newChat: Chat = { 
        id: chatId, 
        name: name, 
        avatar: 'G', 
        type: 'group', 
        status: 'Active', 
        lastMessage: 'Group created', 
        lastMessageTime: Date.now(), 
        adminIds: memberIds, // We use adminIds as "member list" for now in this schema
        unreadCount: 0,
        time: 'Now'
    };
    await localDB.chats.create(newChat);
    onCreated(newChat);
    onClose();
  };

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="New Group">
      <div className="p-6 bg-[#1c1c1e] space-y-6">
         <div className="flex justify-center">
            <div className="w-20 h-20 bg-blue-500 rounded-full flex items-center justify-center text-3xl text-white shadow-xl shadow-blue-500/20">
                <i className="fa-solid fa-users"></i>
            </div>
         </div>
         <div className="space-y-4">
             <div className="bg-[#2c2c2e] px-4 py-3 rounded-xl border border-white/5">
                 <input className="w-full bg-transparent text-white placeholder-gray-500 outline-none font-bold" placeholder="Group Name" value={name} onChange={e => setName(e.target.value)} />
             </div>
             
             <div className="bg-[#2c2c2e] px-4 py-3 rounded-xl border border-white/5">
                 <input className="w-full bg-transparent text-white placeholder-gray-500 outline-none font-bold text-sm" placeholder="Add Members (e.g. @masal @ali)" value={membersInput} onChange={e => setMembersInput(e.target.value)} />
             </div>
             <p className="text-[10px] text-gray-500 px-2">Separate usernames with spaces. Users must exist.</p>
         </div>
         <button onClick={handleCreate} className="w-full py-4 bg-blue-500 text-white rounded-xl font-bold shadow-lg active:scale-95 transition-transform">Create Group</button>
      </div>
    </BaseModal>
  );
};
