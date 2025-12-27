
import React, { useState, useEffect, useRef } from 'react';
import { Story, StoryFrame } from '../types';

interface Props {
  story: Story;
  onClose: () => void;
}

const StoryViewer: React.FC<Props> = ({ story, onClose }) => {
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const frameDuration = 5000; // 5 seconds per frame
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  const currentFrame = story.frames[currentFrameIndex];

  useEffect(() => {
    startTimeRef.current = Date.now();
    setProgress(0);
    
    if (timerRef.current) clearInterval(timerRef.current);
    
    timerRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const nextProgress = Math.min((elapsed / frameDuration) * 100, 100);
      setProgress(nextProgress);

      if (nextProgress >= 100) {
        handleNext();
      }
    }, 30);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentFrameIndex]);

  const handleNext = () => {
    if (currentFrameIndex < story.frames.length - 1) {
      setCurrentFrameIndex(prev => prev + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentFrameIndex > 0) {
      setCurrentFrameIndex(prev => prev - 1);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-black flex flex-col items-center justify-center animate-fade-in rtl" dir="rtl">
      {/* Progress Bars */}
      <div className="absolute top-4 left-4 right-4 flex gap-1.5 z-[1010]">
        {story.frames.map((_, idx) => (
          <div key={idx} className="h-1 flex-1 bg-white/30 rounded-full overflow-hidden">
            <div 
              className="h-full bg-white transition-all duration-30 transition-linear"
              style={{ 
                width: idx < currentFrameIndex ? '100%' : idx === currentFrameIndex ? `${progress}%` : '0%' 
              }}
            />
          </div>
        ))}
      </div>

      {/* Header Info */}
      <div className="absolute top-8 left-4 right-4 flex items-center justify-between z-[1010] text-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-white/50 overflow-hidden bg-white/10 flex items-center justify-center">
             <img src={story.avatar} alt="" className="w-full h-full object-contain p-1" />
          </div>
          <div>
            <div className="font-bold text-sm">{story.username}</div>
            <div className="text-[10px] opacity-70">راهنمای رسمی</div>
          </div>
        </div>
        <button onClick={onClose} className="w-10 h-10 flex items-center justify-center text-2xl active:scale-90 transition-transform">
          <i className="fa-solid fa-xmark"></i>
        </button>
      </div>

      {/* Frame Content */}
      <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden">
        <img 
          src={currentFrame.image} 
          alt={currentFrame.title} 
          className="absolute inset-0 w-full h-full object-cover opacity-60 scale-110 blur-sm"
        />
        <div className="z-10 text-center px-10">
          <div 
            className="w-48 h-48 mx-auto rounded-3xl shadow-2xl mb-12 transform -rotate-3 overflow-hidden border-4 border-white/20"
            style={{ backgroundColor: currentFrame.color }}
          >
            <img src={currentFrame.image} className="w-full h-full object-cover" alt="" />
          </div>
          <h2 className="text-4xl font-black text-white mb-4 drop-shadow-lg">{currentFrame.title}</h2>
          <p className="text-lg text-white/90 font-medium leading-relaxed drop-shadow-md">{currentFrame.description}</p>
        </div>
      </div>

      {/* Tap Areas */}
      <div className="absolute inset-0 z-[1005] flex">
        <div className="flex-1 h-full" onClick={handlePrev} />
        <div className="flex-1 h-full" onClick={handleNext} />
      </div>

      {/* Footer Branding */}
      <div className="absolute bottom-10 z-[1010] text-white/40 text-[10px] font-bold tracking-[0.2em] uppercase">
        Ultimate Messenger • Guide
      </div>
    </div>
  );
};

export default StoryViewer;
