import React, { useState, useRef, useEffect } from 'react';
import { CloseIcon } from './Icons';
import type { Resource } from '../types';
import { ResourceCategory } from '../types';

interface ResourceModalProps {
  resource: Resource;
  onClose: () => void;
}

// Pause and Play SVG Icons
const PlayIcon = () => (
    <svg viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
    </svg>
);

const PauseIcon = () => (
    <svg viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h.5a1 1 0 001-1V8a1 1 0 00-1-1H8zm4.5 0a1 1 0 00-1-1H11a1 1 0 00-1 1v4a1 1 0 001 1h.5a1 1 0 001-1V8a1 1 0 00-1-1h-.5z" clipRule="evenodd" />
    </svg>
);

const ResourceModal: React.FC<ResourceModalProps> = ({ resource, onClose }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const audioRef = useRef<HTMLAudioElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const setAudioData = () => setDuration(audio.duration);
    const setAudioTime = () => setCurrentTime(audio.currentTime);
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('loadedmetadata', setAudioData);
    audio.addEventListener('timeupdate', setAudioTime);
    audio.addEventListener('ended', handleEnded);

    // If the audio is ready, update the duration immediately
    if (audio.readyState > 0) {
      setAudioData();
    }
    
    return () => {
      audio.removeEventListener('loadedmetadata', setAudioData);
      audio.removeEventListener('timeupdate', setAudioTime);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  useEffect(() => {
    if (isPlaying) {
      audioRef.current?.play().catch(error => console.error("Error playing audio:", error));
    } else {
      audioRef.current?.pause();
    }
  }, [isPlaying]);

  const togglePlayPause = () => {
    setIsPlaying(!isPlaying);
  };
  
  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (progressBarRef.current && audioRef.current && isFinite(duration)) {
      const progressBar = progressBarRef.current;
      const clickPositionX = e.pageX - progressBar.getBoundingClientRect().left;
      const barWidth = progressBar.clientWidth;
      const seekTime = (clickPositionX / barWidth) * duration;
      audioRef.current.currentTime = seekTime;
      setCurrentTime(seekTime);
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time) || !isFinite(time)) return '00:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Prevent clicks inside the modal from closing it
  const handleModalContentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="resource-modal-title"
    >
      <div 
        className="bg-ivory rounded-xl shadow-2xl w-full max-w-2xl relative transform transition-all duration-300 scale-95 animate-modal-enter flex flex-col"
        style={{ maxHeight: '85vh' }}
        onClick={handleModalContentClick}
      >
        <div className="p-6 md:p-8 border-b border-sand flex-shrink-0">
            <button 
            onClick={onClose} 
            className="absolute top-4 right-4 text-taupe hover:text-brown-dark transition-colors"
            aria-label="Close resource"
            >
            <CloseIcon className="h-7 w-7" />
            </button>
            <span className="text-sm font-semibold text-brown-soft uppercase tracking-wider">{resource.category}</span>
            <h2 id="resource-modal-title" className="text-2xl md:text-3xl font-serif font-bold text-brown-dark mt-1">{resource.title}</h2>
        </div>

        {resource.category === ResourceCategory.Podcasts && (
          <div className="p-6 md:px-8 flex-shrink-0">
            {/* Hidden audio element */}
            <audio ref={audioRef} src={resource.audioUrl} preload="metadata" crossOrigin="anonymous"></audio>

            <div className="bg-sand rounded-lg p-4 flex items-center space-x-4" aria-label="Audio player">
              <div className="flex-shrink-0">
                <button 
                  className="h-12 w-12 text-brown-soft hover:text-brown-soft/80 transition-colors" 
                  aria-label={isPlaying ? 'Pause podcast' : 'Play podcast'}
                  onClick={togglePlayPause}
                >
                  {isPlaying ? <PauseIcon /> : <PlayIcon />}
                </button>
              </div>
              <div className="flex-grow">
                <div 
                  ref={progressBarRef}
                  className="w-full bg-taupe/50 rounded-full h-1.5 cursor-pointer group" 
                  role="progressbar" 
                  aria-label="Podcast progress" 
                  aria-valuenow={currentTime} 
                  aria-valuemin={0} 
                  aria-valuemax={duration}
                  onClick={handleSeek}
                >
                  <div className="bg-brown-soft h-1.5 rounded-full relative" style={{ width: `${(currentTime / duration) * 100 || 0}%` }}>
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow border border-brown-soft/50 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  </div>
                </div>
                <div className="flex justify-between text-xs text-brown-soft mt-1">
                  <span aria-label="Current time">{formatTime(currentTime)}</span>
                  <span aria-label="Total time">{formatTime(duration)}</span>
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div className={`p-6 md:p-8 overflow-y-auto ${resource.category === ResourceCategory.Podcasts ? 'pt-0' : ''}`}>
          {resource.category === ResourceCategory.Podcasts && (
            <h3 className="text-xl font-serif font-semibold text-brown-dark mb-4">Transcript</h3>
          )}
          <p className="text-brown-soft leading-relaxed whitespace-pre-line">{resource.fullContent}</p>
        </div>

        <div className="p-4 bg-sand rounded-b-xl text-center flex-shrink-0">
            <button onClick={onClose} className="font-semibold text-brown-soft hover:underline">Close</button>
        </div>
      </div>
    </div>
  );
};

export default ResourceModal;