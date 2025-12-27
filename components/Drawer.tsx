
import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { auth } from '../firebase';
import { PrivacyModal } from './Modals';

interface Props {
  user: User;
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
  onProfileClick: () => void;
  onGiftsClick: () => void;
  onInvitesClick: () => void;
  onContactsClick: () => void;
  onAdminClick: () => void;
  snowEnabled: boolean;
  onToggleSnow: () => void;
}

const Drawer: React.FC<Props> = ({ user, isOpen, onClose, onLogout, onProfileClick, onGiftsClick, onInvitesClick, onContactsClick, onAdminClick, snowEnabled, onToggleSnow }) => {
  const [showAccounts, setShowAccounts] = useState(false);
  const [accounts, setAccounts] = useState<User[]>([]);
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
  const [isLightMode, setIsLightMode] = useState(false);

  useEffect(() => {
      if(isOpen) {
          auth.getAccounts().then(setAccounts);
      }
  }, [isOpen]);

  const toggleTheme = () => {
      const html = document.documentElement;
      if (html.classList.contains('light-mode')) {
          html.classList.remove('light-mode');
          setIsLightMode(false);
      } else {
          html.classList.add('light-mode');
          setIsLightMode(true);
      }
  };

  const handleAddAccount = () => {
      onLogout(); // Essentially logs out current to show auth screen, but retains session in storage
  };

  return (
    <>
      <div 
        className={`fixed inset-0 bg-black/85 backdrop-blur-lg z-[150] transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      
      <div 
        className={`fixed top-0 left-0 h-full w-[310px] bg-[var(--winter-bg)] z-[160] transition-transform duration-500 ease-out transform shadow-2xl flex flex-col border-r border-[var(--border-color)] ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="thick-snow relative p-6 bg-gradient-to-br from-[#1c2833] to-[#0b141d] border-b border-[var(--border-color)] overflow-hidden">
          <div className="absolute top-[-20px] right-[-20px] w-40 h-40 bg-blue-500/10 rounded-full blur-3xl"></div>
          
          <div className="relative z-10 rtl" dir="rtl">
            <div className="flex justify-between items-start mb-4">
                <div className="relative group cursor-pointer" onClick={onProfileClick}>
                    <div className="w-16 h-16 aspect-square rounded-full bg-gradient-to-tr from-[#24A1DE] to-[#00e5ff] p-[2px] shadow-2xl">
                        <div className="avatar-frame w-full h-full rounded-full border-2 border-[#0b141d]">
                        <img 
                            src={user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`} 
                            alt="avatar" 
                            className="w-full h-full object-cover"
                        />
                        </div>
                    </div>
                </div>
                
                <button onClick={() => setShowAccounts(!showAccounts)} className="bg-white/10 w-8 h-8 rounded-full flex items-center justify-center text-white transition-transform active:scale-95">
                    <i className={`fa-solid fa-chevron-${showAccounts ? 'up' : 'down'} text-xs`}></i>
                </button>
            </div>

            <div className="text-white text-right w-full cursor-pointer" onClick={onProfileClick}>
              <h4 className="text-lg font-black truncate text-white">{user.displayName || user.username}</h4>
              <p className="text-[11px] text-blue-400 font-mono tracking-wider mt-1">@{user.username}</p>
            </div>
          </div>
        </div>

        {/* ACCOUNTS SWITCHER */}
        {showAccounts && (
            <div className="bg-[#151b24] p-2 animate-slide-in">
                {accounts.filter(u => u.uid !== user.uid).map(acc => (
                    <div key={acc.uid} onClick={() => auth.switchAccount(acc.uid)} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 cursor-pointer">
                        <img src={acc.avatar} className="w-8 h-8 rounded-full" />
                        <div className="flex-1 text-right">
                            <div className="text-xs font-bold text-white">{acc.displayName}</div>
                        </div>
                    </div>
                ))}
                {accounts.length < 3 && (
                    <div onClick={handleAddAccount} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 cursor-pointer text-blue-400">
                        <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center"><i className="fa-solid fa-plus"></i></div>
                        <div className="text-xs font-bold">افزودن حساب کاربری</div>
                    </div>
                )}
            </div>
        )}

        <div className="flex-1 py-4 px-3 overflow-y-auto hide-scrollbar rtl text-[var(--text-primary)]" dir="rtl">
          <div className="space-y-4">
            
            <div className="bg-[var(--input-bg)] rounded-[20px] p-2 border border-[var(--border-color)]">
                <CoolDrawerItem icon="fa-user-ninja" color="text-blue-400" text="My Profile" onClick={onProfileClick} />
                <CoolDrawerItem icon="fa-gift" color="text-pink-400" text="Gift Shop" badge="HOT" onClick={onGiftsClick} />
                <CoolDrawerItem icon="fa-user-group" color="text-green-400" text="Invites" onClick={onInvitesClick} />
            </div>

            <div className="bg-[var(--input-bg)] rounded-[20px] p-2 border border-[var(--border-color)]">
                {/* Privacy Button */}
                <CoolDrawerItem icon="fa-shield-cat" color="text-emerald-400" text="حریم خصوصی و امنیت" onClick={() => setIsPrivacyOpen(true)} />
                
                {/* Theme Toggle */}
                <div onClick={toggleTheme} className="flex items-center gap-4 px-4 py-3 rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 transition-all cursor-pointer group">
                  <div className="w-9 h-9 rounded-xl bg-black/5 dark:bg-white/5 flex items-center justify-center text-lg shadow-sm text-yellow-400">
                    <i className={`fa-solid ${isLightMode ? 'fa-sun' : 'fa-moon'}`}></i>
                  </div>
                  <span className="flex-1 text-[13px] font-bold text-[var(--text-primary)] text-right">حالت شب/روز</span>
                  <div className={`w-8 h-4 rounded-full relative transition-all ${!isLightMode ? 'bg-blue-500' : 'bg-gray-300'}`}>
                    <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${!isLightMode ? 'left-1' : 'right-1'}`}></div>
                  </div>
                </div>

                {/* Snow Toggle */}
                <div onClick={onToggleSnow} className="flex items-center gap-4 px-4 py-3 rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 transition-all cursor-pointer group">
                  <div className="w-9 h-9 rounded-xl bg-black/5 dark:bg-white/5 flex items-center justify-center text-lg shadow-sm text-blue-300">
                    <i className={`fa-solid ${snowEnabled ? 'fa-snowflake' : 'fa-ban'}`}></i>
                  </div>
                  <span className="flex-1 text-[13px] font-bold text-[var(--text-primary)] text-right">برف زمستانی</span>
                  <div className={`w-8 h-4 rounded-full relative transition-all ${snowEnabled ? 'bg-blue-500' : 'bg-gray-300'}`}>
                    <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${snowEnabled ? 'left-1' : 'right-1'}`}></div>
                  </div>
                </div>
            </div>

            {user.isAdmin && (
              <div className="bg-[var(--input-bg)] rounded-[20px] p-2 border border-red-500/10">
                   <CoolDrawerItem icon="fa-shield-halved" color="text-red-400" text="Security Admin" onClick={onAdminClick} />
              </div>
            )}

            <button 
              onClick={onLogout}
              className="w-full flex items-center gap-4 px-6 py-4 bg-red-500/10 text-red-400 font-bold rounded-[20px] border border-red-500/10 transition-all active:scale-95 group"
            >
              <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center shadow-sm group-hover:rotate-12 transition-transform">
                <i className="fa-solid fa-power-off"></i>
              </div>
              <span>خروج از حساب</span>
            </button>
          </div>
        </div>

        <div className="p-6 text-center text-gray-500 text-[9px] font-black tracking-[0.3em] uppercase border-t border-[var(--border-color)]">
          Ultimate Messenger • V3.5
        </div>
      </div>

      <PrivacyModal isOpen={isPrivacyOpen} onClose={() => setIsPrivacyOpen(false)} />
    </>
  );
};

const CoolDrawerItem = ({ icon, color, text, badge, onClick }: { icon: string, color: string, text: string, badge?: string, onClick?: () => void }) => (
  <div 
    onClick={(e) => { e.stopPropagation(); onClick?.(); }}
    className="flex items-center gap-4 px-4 py-3 rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 transition-all cursor-pointer group"
  >
    <div className={`w-9 h-9 rounded-xl bg-black/5 dark:bg-white/5 flex items-center justify-center text-lg shadow-sm ${color}`}>
      <i className={`fa-solid ${icon}`}></i>
    </div>
    <span className="flex-1 text-[13px] font-bold text-[var(--text-primary)] text-right">{text}</span>
    {badge && <span className="bg-red-500 text-white text-[8px] font-black px-2 py-1 rounded-lg shadow-lg">{badge}</span>}
  </div>
);

export default Drawer;
