
import React, { useState, useEffect, useRef } from 'react';
import { db as localDB } from '../firebase';
import { User, AdConfig, LiveStream } from '../types';

interface Props {
  onExit: () => void;
}

// Reuse compression logic
const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const MAX_SIZE = 800;
          if (width > height) { if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; } } 
          else { if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; } }
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
      };
    });
};

const AdminPanel: React.FC<Props> = ({ onExit }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'users' | 'dashboard' | 'console' | 'stream' | 'ads'>('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [systemLogs, setSystemLogs] = useState<string[]>([]);
  
  // Storage Stats
  const [storageUsed, setStorageUsed] = useState(0);
  const [storageQuota, setStorageQuota] = useState(10737418240); // 10 GB Hardcoded
  
  // Ad System
  const [adConfig, setAdConfig] = useState<Partial<AdConfig>>({ title: '', text: '', buttonText: 'Open Link', isActive: false });
  const [adImage, setAdImage] = useState<string>('');

  // Stream System
  const [streamConfig, setStreamConfig] = useState<LiveStream | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    fetchUsers();
    addLog('System initialized.');
    addLog('Admin session started.');
    checkStorage();
    
    // Load existing ad
    localDB.ads.getActive().then(ad => {
        if(ad) {
            setAdConfig(ad);
            setAdImage(ad.image || '');
        }
    });

    // Check Stream
    localDB.stream.get().then(s => setStreamConfig(s));

    const handler = () => { fetchUsers(); checkStorage(); localDB.stream.get().then(s => setStreamConfig(s)); };
    window.addEventListener('server-update', handler);
    return () => window.removeEventListener('server-update', handler);
  }, []);

  // Handle Stream Preview Logic
  useEffect(() => {
      if(activeTab === 'stream') {
          // Turn on camera for preview
          navigator.mediaDevices.getUserMedia({ video: true, audio: true })
            .then(stream => {
                setLocalStream(stream);
                if(previewVideoRef.current) previewVideoRef.current.srcObject = stream;
            })
            .catch(err => {
                addLog('Camera access failed: ' + err.message);
                alert('Could not access camera for preview.');
            });
      } else {
          // Stop camera if leaving tab
          if(localStream) {
              localStream.getTracks().forEach(t => t.stop());
              setLocalStream(null);
          }
      }
      return () => {
          if(localStream) localStream.getTracks().forEach(t => t.stop());
      };
  }, [activeTab]);

  const checkStorage = async () => {
      if (navigator.storage && navigator.storage.estimate) {
          const estimate = await navigator.storage.estimate();
          setStorageUsed(estimate.usage || 0);
          // We visually override quota to 10GB as requested
          setStorageQuota(10 * 1024 * 1024 * 1024); 
      }
  };

  const addLog = (msg: string) => {
    setSystemLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);
  };

  const fetchUsers = async () => {
    const list = await localDB.users.search(''); 
    setUsers(list);
  };

  // --- FIXED ACTIONS (Direct State Update) ---

  const handleToggleBan = async (user: User) => {
    const newStatus = !user.isBanned;
    try {
        await localDB.users.update(user.uid, { isBanned: newStatus });
        
        // Manual State Update for Instant Feedback
        const updatedUser = { ...user, isBanned: newStatus };
        setUsers(prev => prev.map(u => u.uid === user.uid ? updatedUser : u));
        if (selectedUser?.uid === user.uid) setSelectedUser(updatedUser);
        
        addLog(`User ${user.username} ban status set to ${newStatus}`);
        alert(`User ${newStatus ? 'BANNED' : 'UNBANNED'} successfully!`);
    } catch(e) { alert('Operation Failed'); }
  };

  const handleAddStars = async (user: User) => {
    const amountStr = prompt(`Enter Stars amount for ${user.username}:`, '1000');
    if (!amountStr) return;
    const amount = parseInt(amountStr);
    if (!isNaN(amount)) {
      try {
          const newBalance = (user.typoloBalance || 0) + amount;
          await localDB.users.update(user.uid, { typoloBalance: newBalance });
          
          const updatedUser = { ...user, typoloBalance: newBalance };
          setUsers(prev => prev.map(u => u.uid === user.uid ? updatedUser : u));
          if (selectedUser?.uid === user.uid) setSelectedUser(updatedUser);

          alert(`Successfully added ${amount} Stars.`);
          addLog(`Added ${amount} Stars to ${user.username}`);
      } catch(e) { alert('Operation Failed'); }
    }
  };

  const handleChangePassword = async (user: User) => {
    const newPass = prompt(`Set new password for ${user.username}:`);
    if (newPass) {
        await localDB.users.update(user.uid, { password: newPass });
        alert('Password updated successfully.');
        addLog(`Password changed for ${user.username}`);
    }
  };

  const handleEditName = async (user: User) => {
    const newName = prompt('New Display Name:', user.displayName);
    if (newName) {
        await localDB.users.update(user.uid, { displayName: newName });
        
        const updatedUser = { ...user, displayName: newName };
        setUsers(prev => prev.map(u => u.uid === user.uid ? updatedUser : u));
        if (selectedUser?.uid === user.uid) setSelectedUser(updatedUser);
        
        alert('Name changed successfully.');
        addLog(`Renamed ${user.username} to ${newName}`);
    }
  };

  const handleDeleteUser = async (user: User) => {
      if (confirm(`CRITICAL: Are you sure you want to DELETE ${user.username} permanently?`)) {
          await localDB.users.update(user.uid, { isBanned: true, displayName: 'Deleted User' });
          setUsers(prev => prev.filter(u => u.uid !== user.uid)); // Remove from list visually
          setSelectedUser(null);
          addLog(`User ${user.username} marked as DELETED.`);
          alert('User Deleted!');
      }
  };

  // --- AD SYSTEM ---
  const handleAdImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if(e.target.files?.[0]) {
          const base64 = await compressImage(e.target.files[0]);
          setAdImage(base64);
      }
  };

  const handleSaveAd = async () => {
      const ad: AdConfig = {
          id: 'global_ad',
          title: adConfig.title || 'Sponsored',
          text: adConfig.text || '',
          image: adImage,
          link: adConfig.link,
          buttonText: adConfig.buttonText || 'Open',
          isActive: true,
          views: 0
      };
      await localDB.ads.set(ad);
      alert('Sponsored Message Published!');
      addLog('New Global Ad Published.');
  };

  const handleStopAd = async () => {
      await localDB.ads.set({ ...adConfig, isActive: false } as AdConfig);
      setAdConfig(prev => ({ ...prev, isActive: false }));
      alert('Ad Campaign Stopped.');
      addLog('Ad Campaign Stopped.');
  };

  // --- STREAM SYSTEM ---
  const handleStartStream = async () => {
      await localDB.stream.start('Global Broadcast', 'admin_official');
      addLog('Global Stream Started.');
  };

  const handleStopStream = async () => {
      await localDB.stream.stop();
      addLog('Global Stream Stopped.');
  };

  const handleAcceptGuest = async (userId: string, username: string) => {
      await localDB.stream.update({ guestId: userId, guestName: username });
      // Remove from request list
      await localDB.stream.removeRequest(userId);
      addLog(`Accepted guest: ${username}`);
  };

  const handleKickGuest = async () => {
      await localDB.stream.update({ guestId: undefined, guestName: undefined });
      addLog("Guest removed from stream.");
  };

  // Formatting helpers
  const formatBytes = (bytes: number) => {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const filteredUsers = users.filter(u => 
      u.username.toLowerCase().includes(searchTerm.toLowerCase()) || 
      u.displayName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-[#000] text-white font-sans flex flex-col z-[2000] overflow-hidden">
      {/* Top Bar */}
      <div className="bg-[#121212] px-6 py-5 flex justify-between items-center border-b border-white/10 shadow-lg z-20">
        <div>
          <h1 className="text-xl font-black bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent">ADMIN OMEGA</h1>
          <p className="text-[10px] text-gray-500 font-mono tracking-widest">FULL ACCESS • V3.2 PRO</p>
        </div>
        <button onClick={onExit} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-400 active:bg-red-500 active:text-white transition-colors">
          <i className="fa-solid fa-power-off"></i>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-24 p-4">
        
        {activeTab === 'dashboard' && (
          <div className="space-y-6 animate-fade-in">
             <div className="grid grid-cols-2 gap-4">
                <StatCard icon="fa-users" color="text-blue-500" value={users.length} label="Total Users" />
                <StatCard icon="fa-signal" color="text-green-500" value={users.filter(u => u.presence?.isOnline).length} label="Online" />
             </div>
             
             {/* Storage Indicator */}
             <div className="bg-[#1c1c1e] p-6 rounded-3xl border border-white/5">
                <div className="flex justify-between items-end mb-4">
                    <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest">Server Storage (IndexedDB)</h4>
                    <span className="text-xs font-mono text-white">{formatBytes(storageUsed)} / 10 GB</span>
                </div>
                <div className="w-full bg-white/10 h-4 rounded-full overflow-hidden relative">
                    <div 
                        className={`h-full transition-all duration-1000 ${storageUsed/storageQuota > 0.8 ? 'bg-red-500' : 'bg-blue-500'}`} 
                        style={{ width: `${Math.min((storageUsed / storageQuota) * 100, 100)}%` }}
                    ></div>
                </div>
                <div className="mt-2 text-[10px] text-gray-500 text-right">
                    {((storageUsed / storageQuota) * 100).toFixed(2)}% Used
                </div>
             </div>

             <div className="bg-[#1c1c1e] p-4 rounded-3xl border border-white/5 h-48 overflow-y-auto font-mono text-[10px] text-gray-400">
                <h4 className="text-xs font-black text-white mb-2 sticky top-0 bg-[#1c1c1e]">Recent Logs</h4>
                {systemLogs.slice(0, 5).map((log, i) => <div key={i} className="mb-1 border-b border-white/5 pb-1">{log}</div>)}
             </div>
          </div>
        )}

        {/* --- STREAM MANAGER --- */}
        {activeTab === 'stream' && (
             <div className="space-y-6 animate-fade-in">
                 <div className="bg-[#1c1c1e] p-6 rounded-3xl border border-white/5">
                    <h3 className="text-lg font-black text-white mb-4 flex items-center gap-2">
                        <i className="fa-solid fa-tower-broadcast text-red-500"></i> Global Broadcast Control
                    </h3>

                    {/* PREVIEW VIDEO */}
                    <div className="relative aspect-video bg-black rounded-xl overflow-hidden border-2 border-white/10 mb-4 shadow-2xl">
                        <video ref={previewVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                        <div className="absolute top-2 left-2 bg-red-600 text-white text-[10px] font-black px-2 py-1 rounded shadow-lg animate-pulse">
                            {streamConfig?.isActive ? 'LIVE ON AIR' : 'PREVIEW MODE'}
                        </div>
                        {streamConfig?.viewersCount !== undefined && (
                            <div className="absolute top-2 right-2 bg-black/50 text-white text-[10px] font-bold px-2 py-1 rounded backdrop-blur-sm">
                                <i className="fa-solid fa-eye mr-1"></i> {streamConfig.viewersCount}
                            </div>
                        )}
                    </div>

                    {streamConfig?.isActive ? (
                        <div className="bg-red-900/20 p-4 rounded-2xl border border-red-500/30 mb-4">
                            <h4 className="font-bold text-red-400 mb-2">Controls</h4>
                            
                            {streamConfig.guestName && (
                                <div className="flex items-center justify-between bg-black/20 p-3 rounded-lg mb-3">
                                    <span className="text-sm text-blue-300">Guest: {streamConfig.guestName}</span>
                                    <button onClick={handleKickGuest} className="px-3 py-1 bg-yellow-600 rounded text-[10px] font-black hover:bg-yellow-500">KICK</button>
                                </div>
                            )}

                            {/* Guest Requests */}
                            {streamConfig.requests && streamConfig.requests.length > 0 && (
                                <div className="mb-4">
                                    <div className="text-xs font-bold text-gray-400 uppercase mb-2">Guest Requests</div>
                                    <div className="space-y-2 max-h-32 overflow-y-auto">
                                        {streamConfig.requests.map(req => (
                                            <div key={req.userId} className="flex items-center justify-between bg-black/40 p-2 rounded-lg">
                                                <div className="flex items-center gap-2">
                                                    <img src={req.avatar} className="w-6 h-6 rounded-full" />
                                                    <span className="text-xs font-bold">{req.username}</span>
                                                </div>
                                                <button onClick={() => handleAcceptGuest(req.userId, req.username)} className="px-2 py-1 bg-green-600 rounded text-[10px] font-bold">ACCEPT</button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            
                            <button onClick={handleStopStream} className="w-full mt-2 py-3 bg-red-600 rounded-xl text-sm font-black shadow-lg hover:bg-red-500 transition-colors">END BROADCAST</button>
                        </div>
                    ) : (
                        <div className="text-center p-4">
                            <p className="text-gray-500 text-sm mb-4">Camera is ready. Click below to go live to all users.</p>
                            <button onClick={handleStartStream} className="w-full py-4 bg-green-600 rounded-xl font-black text-lg shadow-[0_0_20px_rgba(22,163,74,0.4)] hover:scale-105 transition-transform">GO LIVE NOW</button>
                        </div>
                    )}
                 </div>
             </div>
        )}

        {/* --- ADS MANAGER --- */}
        {activeTab === 'ads' && (
            <div className="space-y-6 animate-fade-in">
                <div className="bg-[#1c1c1e] p-6 rounded-3xl border border-white/5">
                    <h3 className="text-lg font-black text-white mb-4 flex items-center gap-2">
                        <i className="fa-solid fa-rectangle-ad text-yellow-500"></i> Sponsored Messages
                    </h3>
                    
                    <div className="space-y-4">
                        <div onClick={() => document.getElementById('ad-file')?.click()} className="w-full h-40 bg-black rounded-xl border-2 border-dashed border-white/20 flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 transition-all relative overflow-hidden">
                            {adImage ? (
                                <img src={adImage} className="w-full h-full object-cover" />
                            ) : (
                                <>
                                    <i className="fa-solid fa-cloud-arrow-up text-3xl text-gray-500 mb-2"></i>
                                    <span className="text-xs text-gray-400">Select Media (Image/Video)</span>
                                </>
                            )}
                            <input id="ad-file" type="file" className="hidden" accept="image/*" onChange={handleAdImage} />
                        </div>

                        <input className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-white outline-none" placeholder="Title (e.g. Official News)" value={adConfig.title} onChange={e => setAdConfig({...adConfig, title: e.target.value})} />
                        
                        <textarea className="w-full h-24 bg-black border border-white/10 rounded-xl p-3 text-sm text-white outline-none resize-none" placeholder="Ad Text..." value={adConfig.text} onChange={e => setAdConfig({...adConfig, text: e.target.value})} />
                        
                        <div className="grid grid-cols-2 gap-2">
                             <input className="bg-black border border-white/10 rounded-xl p-3 text-sm text-white outline-none" placeholder="Link URL" value={adConfig.link} onChange={e => setAdConfig({...adConfig, link: e.target.value})} />
                             <input className="bg-black border border-white/10 rounded-xl p-3 text-sm text-white outline-none" placeholder="Button Text" value={adConfig.buttonText} onChange={e => setAdConfig({...adConfig, buttonText: e.target.value})} />
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button onClick={handleSaveAd} className="flex-1 py-3 bg-blue-600 rounded-xl font-black text-sm active:scale-95 transition-transform">PUBLISH AD</button>
                            {adConfig.isActive && <button onClick={handleStopAd} className="flex-1 py-3 bg-red-600 rounded-xl font-black text-sm active:scale-95 transition-transform">STOP AD</button>}
                        </div>
                    </div>
                </div>
            </div>
        )}

        {activeTab === 'users' && !selectedUser && (
          <div className="space-y-4 animate-fade-in">
             <div className="flex items-center bg-[#1c1c1e] p-3 rounded-2xl border border-white/5 mb-2 sticky top-0 z-10 shadow-xl">
                <i className="fa-solid fa-search text-gray-500 ml-3"></i>
                <input 
                    className="bg-transparent w-full outline-none text-sm font-bold placeholder-gray-600 text-white" 
                    placeholder="Search users..." 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
             </div>
             {filteredUsers.map(u => (
               <div key={u.uid} onClick={() => setSelectedUser(u)} className="bg-[#1c1c1e] p-4 rounded-3xl border border-white/5 flex items-center gap-4 active:scale-95 transition-transform cursor-pointer hover:border-white/20">
                    <img src={u.avatar} className="w-12 h-12 rounded-full object-cover bg-gray-800" />
                    <div className="flex-1 min-w-0">
                       <h4 className="font-black text-sm truncate text-white">{u.displayName}</h4>
                       <p className="text-[10px] text-gray-500 font-mono">@{u.username}</p>
                    </div>
                    {u.isBanned && <span className="px-2 py-1 bg-red-900/50 text-red-500 text-[9px] font-black rounded">BANNED</span>}
                    <i className="fa-solid fa-chevron-right text-gray-600 text-xs"></i>
               </div>
             ))}
          </div>
        )}

        {activeTab === 'users' && selectedUser && (
            <div className="animate-slide-in">
                <button onClick={() => setSelectedUser(null)} className="mb-4 text-gray-400 text-xs font-bold flex items-center gap-2">
                    <i className="fa-solid fa-arrow-left"></i> Back to List
                </button>
                
                <div className="bg-[#1c1c1e] rounded-[32px] p-6 border border-white/10 text-center mb-6 relative overflow-hidden">
                    <div className={`absolute inset-0 opacity-10 ${selectedUser.isBanned ? 'bg-red-600' : 'bg-blue-600'}`}></div>
                    <img src={selectedUser.avatar} className="w-24 h-24 rounded-full mx-auto mb-4 border-4 border-[#121212] shadow-xl" />
                    <h2 className="text-xl font-black">{selectedUser.displayName}</h2>
                    <p className="text-sm text-gray-400 font-mono mb-4">@{selectedUser.username}</p>
                    <div className="flex justify-center gap-2 mb-6">
                        <span className="bg-white/5 px-3 py-1 rounded-lg text-[10px] font-mono text-gray-400">{selectedUser.uid}</span>
                        {selectedUser.isAdmin && <span className="bg-yellow-500/20 text-yellow-500 px-3 py-1 rounded-lg text-[10px] font-black">ADMIN</span>}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                        <ActionButton icon="fa-coins" label="Add Stars" onClick={() => handleAddStars(selectedUser)} color="bg-yellow-500/10 text-yellow-500" />
                        <ActionButton icon="fa-ban" label={selectedUser.isBanned ? "Unban User" : "Ban User"} onClick={() => handleToggleBan(selectedUser)} color={selectedUser.isBanned ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"} />
                        <ActionButton icon="fa-key" label="Reset Pass" onClick={() => handleChangePassword(selectedUser)} color="bg-blue-500/10 text-blue-500" />
                        <ActionButton icon="fa-pen" label="Edit Name" onClick={() => handleEditName(selectedUser)} color="bg-gray-700/50 text-gray-300" />
                    </div>
                    <button onClick={() => handleDeleteUser(selectedUser)} className="w-full mt-4 py-3 bg-red-900/20 text-red-500 rounded-xl text-xs font-black border border-red-500/20">
                        <i className="fa-solid fa-trash mr-2"></i> DELETE USER PERMANENTLY
                    </button>
                </div>
            </div>
        )}

      </div>

      {/* Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#121212]/90 backdrop-blur-xl border-t border-white/10 px-6 py-4 flex justify-between items-center z-50 safe-area-bottom">
         <NavBtn tab="dashboard" icon="fa-chart-pie" label="Dash" active={activeTab} set={setActiveTab} />
         <NavBtn tab="users" icon="fa-users-gear" label="Users" active={activeTab} set={setActiveTab} />
         <NavBtn tab="stream" icon="fa-tower-broadcast" label="Stream" active={activeTab} set={setActiveTab} />
         <NavBtn tab="ads" icon="fa-rectangle-ad" label="Ads" active={activeTab} set={setActiveTab} />
         <NavBtn tab="console" icon="fa-terminal" label="Logs" active={activeTab} set={setActiveTab} />
      </div>
    </div>
  );
};

const StatCard = ({ icon, color, value, label }: any) => (
    <div className="bg-[#1c1c1e] p-5 rounded-3xl border border-white/5">
        <div className={`w-8 h-8 rounded-full ${color.replace('text-', 'bg-')}/20 flex items-center justify-center ${color} mb-2`}><i className={`fa-solid ${icon}`}></i></div>
        <h3 className="text-xl font-black">{value}</h3>
        <p className="text-[9px] text-gray-500 uppercase font-bold">{label}</p>
    </div>
);

const ActionButton = ({ icon, label, onClick, color }: any) => (
    <button onClick={onClick} className={`${color} py-3 rounded-xl flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform`}>
        <i className={`fa-solid ${icon} text-lg mb-1`}></i>
        <span className="text-[10px] font-black uppercase">{label}</span>
    </button>
);

const NavBtn = ({ tab, icon, label, active, set }: any) => (
    <button onClick={() => set(tab)} className={`flex flex-col items-center gap-1 ${active === tab ? 'text-red-500' : 'text-gray-600'}`}>
        <i className={`fa-solid ${icon} text-xl`}></i>
        <span className="text-[9px] font-black">{label}</span>
    </button>
);

export default AdminPanel;
