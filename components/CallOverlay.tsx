import React, { useState, useEffect, useRef } from 'react';
import { User, CallSession } from '../types';
import { db as localDB } from '../firebase';

interface CallProps {
  user: User;
  callData: CallSession;
  onClose: () => void;
}

const CallOverlay: React.FC<CallProps> = ({ user, callData, onClose }) => {
  const [status, setStatus] = useState<'ringing' | 'connected' | 'ending'>(callData.status as any);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [duration, setDuration] = useState(0);
  const [peerUser, setPeerUser] = useState<User | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const durationInterval = useRef<number | null>(null);

  const isCaller = callData.callerId === user.uid;

  useEffect(() => {
      const loadPeerInfo = async () => {
          const peerId = isCaller ? callData.receiverId : callData.callerId;
          if (peerId) {
              const peer = await localDB.users.get(peerId);
              setPeerUser(peer);
          }
      };
      loadPeerInfo();
  }, [callData, isCaller]);

  useEffect(() => {
    const checkStatus = async () => {
        const calls = await localDB.calls.getActiveCalls(user.uid);
        const myCall = calls.find(c => c.id === callData.id);

        if (!myCall) {
            handleCleanup();
        } else if (myCall.status === 'connected' && status === 'ringing') {
            setStatus('connected');
        } else if (myCall.status === 'ended' || myCall.status === 'rejected') {
            handleCleanup();
        }
    };

    const interval = setInterval(checkStatus, 1000);
    const listener = () => checkStatus();
    window.addEventListener('server-update', listener);

    return () => {
        clearInterval(interval);
        window.removeEventListener('server-update', listener);
    };
  }, [callData.id, status]);

  useEffect(() => {
    const startMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: callData.type === 'video'
        });
        setLocalStream(stream);
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      } catch (err: any) {
        console.warn("Media access denied", err);
      }
    };

    startMedia();

    return () => {
        if (localStream) localStream.getTracks().forEach(t => t.stop());
    };
  }, []);

  useEffect(() => {
      if (status === 'connected') {
          durationInterval.current = window.setInterval(() => {
              setDuration(d => d + 1);
          }, 1000);
      }
      return () => {
          if (durationInterval.current) clearInterval(durationInterval.current);
      }
  }, [status]);

  const handleCleanup = () => {
    if (localStream) localStream.getTracks().forEach(t => t.stop());
    onClose();
  };

  const handleEndCall = async () => {
    setStatus('ending');
    await localDB.calls.updateStatus(callData.id, 'ended');
    setTimeout(handleCleanup, 500);
  };

  const handleAccept = async () => {
    await localDB.calls.updateStatus(callData.id, 'connected');
    setStatus('connected');
  };

  const formatTime = (sec: number) => {
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const peerName = peerUser ? peerUser.displayName : (isCaller ? "Unknown User" : callData.callerName);
  const peerAvatar = peerUser ? peerUser.avatar : (isCaller ? "" : callData.callerAvatar);

  return (
    <div className="fixed inset-0 z-[9999] bg-[#0f1115] text-white flex flex-col font-sans animate-fade-in overflow-hidden">

        {callData.type === 'video' && (
            <div className="absolute inset-0 z-0">
                <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover ${status === 'ringing' ? 'blur-xl scale-110 opacity-50' : 'opacity-100'}`}
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80"></div>
            </div>
        )}

        {callData.type === 'audio' && (
             <div className="absolute inset-0 z-0 bg-[#1c2833] flex items-center justify-center">
                 <div className="absolute inset-0 opacity-30 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
                 {status === 'ringing' && <div className="absolute inset-0 bg-blue-500/10 animate-pulse"></div>}
             </div>
        )}

        <div className="relative z-10 pt-16 flex flex-col items-center">
            {callData.type === 'audio' && (
                 <div className="w-32 h-32 rounded-full border-4 border-white/10 shadow-2xl mb-6 overflow-hidden bg-gray-800">
                    <img src={peerAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${peerName}`} className="w-full h-full object-cover" />
                 </div>
            )}

            <h2 className="text-3xl font-black mb-2 drop-shadow-md">{peerName}</h2>

            <p className="text-lg font-medium opacity-80 drop-shadow-md">
                {status === 'ringing' ? (isCaller ? 'Ringing...' : 'Incoming Call...') : formatTime(duration)}
            </p>
        </div>

        <div className="absolute bottom-12 left-0 right-0 z-10 px-10">
            <div className="bg-[#1c1c1e]/60 backdrop-blur-xl rounded-[40px] p-6 flex items-center justify-around shadow-2xl border border-white/10">

                {status === 'ringing' && !isCaller ? (
                    <>
                         <button onClick={handleEndCall} className="flex flex-col items-center gap-2 group">
                             <div className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center shadow-lg group-active:scale-95 transition-all">
                                 <i className="fa-solid fa-phone-slash text-2xl"></i>
                             </div>
                             <span className="text-xs font-bold">Decline</span>
                         </button>

                         <div className="flex flex-col items-center gap-2 animate-bounce-slow">
                             <i className="fa-solid fa-chevron-up text-white/50"></i>
                             <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Swipe</span>
                         </div>

                         <button onClick={handleAccept} className="flex flex-col items-center gap-2 group">
                             <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center shadow-lg group-active:scale-95 transition-all animate-pulse">
                                 <i className={`fa-solid ${callData.type === 'video' ? 'fa-video' : 'fa-phone'} text-2xl`}></i>
                             </div>
                             <span className="text-xs font-bold">Accept</span>
                         </button>
                    </>
                ) : (
                    <>
                        <button className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center active:bg-white/20">
                            <i className="fa-solid fa-microphone-slash text-xl"></i>
                        </button>

                        {callData.type === 'video' && (
                             <button className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center active:bg-white/20">
                                <i className="fa-solid fa-camera-rotate text-xl"></i>
                             </button>
                        )}

                        <button onClick={handleEndCall} className="w-20 h-20 rounded-full bg-red-600 shadow-xl flex items-center justify-center active:scale-95 transition-transform border-4 border-[#1c1c1e]">
                            <i className="fa-solid fa-phone-slash text-3xl"></i>
                        </button>

                        <button className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center active:bg-white/20">
                            <i className="fa-solid fa-volume-high text-xl"></i>
                        </button>
                    </>
                )}
            </div>
        </div>
    </div>
  );
};

export default CallOverlay;

