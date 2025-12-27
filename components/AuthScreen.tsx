
import React, { useState, useRef } from 'react';
import { db as localDB, auth } from '../firebase';
import { User } from '../types';

interface Props {
  onLogin: (user: any) => void;
  onAdminLogin: () => void;
}

const AuthScreen: React.FC<Props> = ({ onLogin, onAdminLogin }) => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [avatar, setAvatar] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAction = async () => {
    if (loading) return;
    setLoading(true);
    setError('');
    
    try {
      const normalizedUsername = username.toLowerCase().trim();
      const inputPass = password.trim();

      // ADMIN CHECK
      if (normalizedUsername === 'admin' && inputPass === '110011') {
        setLoading(false);
        onAdminLogin();
        return;
      }
      
      if (mode === 'signup') {
        const existing = await localDB.users.search(normalizedUsername);
        const exists = existing.find(u => u.username === normalizedUsername);
        
        if (exists) throw new Error('این نام کاربری قبلاً انتخاب شده است.');
        
        const uid = 'user_' + Date.now();
        const newUser: User = {
          uid,
          numericId: Date.now(),
          username: normalizedUsername,
          password: inputPass,
          displayName: displayName.trim() || normalizedUsername,
          avatar: avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${normalizedUsername}`,
          typoloBalance: 100,
          gifts: [],
          isAdmin: false,
          referralCount: 0,
          inviteLink: `${window.location.origin}?invite=${uid}`,
          presence: { isOnline: true, lastSeen: Date.now(), statusHidden: false },
          privacy: { inactivityMonths: 6, lastSeen: 'everybody', forwarding: 'everybody' },
          joinedChannels: [],
          archivedChats: [],
          sessions: [],
          blockedUsers: [],
          contacts: []
        };

        await localDB.users.create(newUser);
        auth.login(newUser); // Explicit login
        onLogin(newUser);

      } else {
        const results = await localDB.users.search(normalizedUsername);
        const user = results.find(u => u.username === normalizedUsername);
        
        if (!user) throw new Error('کاربری با این نام کاربری یافت نشد.');
        if (user.password !== inputPass) throw new Error('رمز عبور اشتباه است.');

        auth.login(user); // Explicit login
        onLogin(user);
      }
    } catch (e: any) {
      setError(e.message || 'خطایی رخ داد');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-white flex flex-col items-center z-[500] font-sans rtl" dir="rtl">
      <div className="w-full h-1 bg-[#24A1DE]"></div>
      <div className="w-full max-w-sm px-8 mt-12 overflow-y-auto hide-scrollbar">
        <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-[#24A1DE] rounded-[24px] flex items-center justify-center shadow-xl -rotate-6">
                <i className="fa-solid fa-paper-plane text-white text-4xl"></i>
            </div>
        </div>
        <h2 className="text-2xl font-black text-gray-900 mb-2 text-center">{mode === 'login' ? 'ورود' : 'ثبت نام'}</h2>
        <div className="space-y-4 mt-8">
          {mode === 'signup' && (
            <input className="w-full py-3 bg-gray-50 px-4 rounded-xl outline-none focus:ring-1 ring-blue-500 text-right" placeholder="نام نمایشی" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          )}
          <input className="w-full py-3 bg-gray-50 px-4 rounded-xl outline-none focus:ring-1 ring-blue-500 text-right" placeholder="نام کاربری (انگلیسی)" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} />
          <input type="password" className="w-full py-3 bg-gray-50 px-4 rounded-xl outline-none focus:ring-1 ring-blue-500 text-right" placeholder="رمز عبور" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <div className="text-red-500 text-xs font-bold text-center">{error}</div>}
          <button onClick={handleAction} className="w-full py-4 bg-[#24A1DE] text-white rounded-xl font-bold shadow-lg active:scale-95 transition-all">{loading ? '...' : (mode === 'login' ? 'ورود' : 'ثبت نام')}</button>
          <button onClick={() => setMode(mode === 'login' ? 'signup' : 'login')} className="w-full py-2 text-[#24A1DE] font-bold text-sm text-center">{mode === 'login' ? 'حساب ندارید؟ بسازید' : 'اکانت دارید؟ وارد شوید'}</button>
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;
