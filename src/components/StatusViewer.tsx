'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { X, ChevronLeft, ChevronRight, Play, Pause, MoreVertical, Volume2, VolumeX, Loader2 } from 'lucide-react'
import Image from 'next/image'
import { Status } from '@/hooks/useStatuses'

interface StatusViewerProps {
  statuses: Status[]
  onClose: () => void
}

export default function StatusViewer({ statuses, onClose }: StatusViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [currentDuration, setCurrentDuration] = useState(5000) // Default 5s for images
  const [isWaiting, setIsWaiting] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  const currentStatus = statuses[currentIndex]

  // Sync video play/pause with isPaused state
  useEffect(() => {
    if (videoRef.current) {
      if (isPaused || isWaiting) {
        videoRef.current.pause()
      } else {
        videoRef.current.play().catch(() => {})
      }
    }
  }, [isPaused, isWaiting])

  const goToNext = useCallback(() => {
    if (currentIndex < statuses.length - 1) {
      setCurrentIndex(prev => prev + 1)
      setProgress(0)
      setCurrentDuration(5000) // Reset to standard 5s for the next item
      setIsWaiting(false)
    } else {
      onClose()
    }
  }, [currentIndex, statuses.length, onClose])

  const goToPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1)
      setProgress(0)
      setCurrentDuration(5000)
      setIsWaiting(false)
    }
  }

  // Handle video metadata loading to set correct duration
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      // Use video duration but cap at 30 seconds
      const vidDur = Math.min(videoRef.current.duration * 1000, 30000)
      setCurrentDuration(vidDur)
    }
  }

  useEffect(() => {
    if (isPaused || isWaiting) return

    const interval = 50 
    const step = (100 / (currentDuration / interval))
    
    const timer = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) return 100
        return Math.min(prev + step, 100)
      })
    }, interval)

    return () => clearInterval(timer)
  }, [isPaused, isWaiting, currentDuration])

  useEffect(() => {
    if (progress >= 100) {
      goToNext()
    }
  }, [progress, goToNext])

  return (
    <div className="fixed inset-0 z-[300] bg-black flex flex-col select-none overflow-hidden touch-none animate-in fade-in zoom-in-95 duration-200">
      
      {/* Background Blur for Aspect Ratio (Premium Look) */}
      <div className="absolute inset-0 opacity-40 blur-3xl scale-125 z-0 pointer-events-none">
        {currentStatus.content_type === 'video' ? (
          <video src={currentStatus.content_url} muted className="w-full h-full object-cover" />
        ) : (
          <Image src={currentStatus.content_url} alt="Blur" fill unoptimized className="object-cover" />
        )}
      </div>

      {/* Progress Bars */}
      <div className="absolute top-0 left-0 right-0 z-[310] flex gap-1.5 p-3 px-4 bg-gradient-to-b from-black/80 to-transparent">
        {statuses.map((_, i) => (
          <div key={i} className="h-1 flex-1 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm">
             <div 
                className="h-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.6)] transition-all duration-75"
                style={{ 
                    width: i < currentIndex ? '100%' : i === currentIndex ? `${progress}%` : '0%' 
                }}
             />
          </div>
        ))}
      </div>

      {/* Header Profile */}
      <div className="absolute top-8 left-0 right-0 z-[310] flex items-center justify-between px-4 text-white">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 -ml-2 hover:bg-white/10 rounded-full transition-colors"><ChevronLeft className="w-6 h-6" /></button>
          <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white/30 shadow-lg">
             {currentStatus.user?.avatar_url ? (
                <Image src={currentStatus.user.avatar_url} alt="Profile" width={40} height={40} className="object-cover" />
             ) : (
                <div className="w-full h-full bg-[#00a884] flex items-center justify-center font-bold">{currentStatus.user?.name?.[0]}</div>
             )}
          </div>
          <div>
            <p className="font-bold text-sm leading-tight drop-shadow-md">{currentStatus.user?.name || 'User'}</p>
            <p className="text-[10px] text-white/70 leading-tight drop-shadow-md font-medium">
              {new Date(currentStatus.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
            <button 
              onClick={() => setIsMuted(!isMuted)} 
              className="p-2.5 hover:bg-white/10 rounded-full transition-colors backdrop-blur-md"
              title={isMuted ? "Unmute" : "Mute"}
            >
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
            <button 
              onClick={() => setIsPaused(!isPaused)} 
              className="p-2.5 hover:bg-white/10 rounded-full transition-colors backdrop-blur-md"
            >
                {isPaused ? <Play className="w-5 h-5 fill-white" /> : <Pause className="w-5 h-5 fill-white" />}
            </button>
            <button onClick={onClose} className="p-2.5 hover:bg-white/10 rounded-full transition-colors backdrop-blur-md"><X className="w-6 h-6" /></button>
        </div>
      </div>

      {/* Main Content (Fullscreen Background) */}
      <div 
        className="absolute inset-0 z-10 flex items-center justify-center bg-black"
        onMouseDown={() => setIsPaused(true)}
        onMouseUp={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
      >
        {/* Navigation Overlays */}
        <div className="absolute left-0 top-0 w-1/2 h-full cursor-pointer z-40 opacity-0" onClick={goToPrev} />
        <div className="absolute right-0 top-0 w-1/2 h-full cursor-pointer z-40 opacity-0" onClick={goToNext} />

        {currentStatus.content_type === 'video' ? (
          <div className="relative w-full h-full flex items-center justify-center">
            {isWaiting && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
                <Loader2 className="w-12 h-12 text-white animate-spin opacity-80" />
              </div>
            )}
            <video 
              ref={videoRef}
              src={currentStatus.content_url} 
              autoPlay 
              muted={isMuted}
              loop={false}
              onLoadedMetadata={handleLoadedMetadata}
              onWaiting={() => setIsWaiting(true)}
              onPlaying={() => setIsWaiting(false)}
              onPause={() => setIsPaused(true)}
              onPlay={() => setIsPaused(false)}
              onEnded={goToNext}
              className="w-full h-full object-contain z-10"
            />
          </div>
        ) : (
          <div className="relative w-full h-full">
            <Image 
              src={currentStatus.content_url} 
              alt="Status" 
              fill
              unoptimized
              className="object-contain z-10"
              priority
            />
          </div>
        )}

        {/* Caption Overlay - Fixed at bottom of content */}
        {currentStatus.caption && (
          <div className="absolute bottom-28 left-0 right-0 text-center px-8 z-50">
            <div className="inline-block bg-black/40 backdrop-blur-xl px-7 py-3 rounded-2xl text-white text-base font-medium shadow-2xl border border-white/10 max-w-[80%] mx-auto">
              {currentStatus.caption}
            </div>
          </div>
        )}
      </div>

      {/* Footer Overlay */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black/80 to-transparent flex flex-col items-center justify-center text-white/40 text-[9px] italic font-bold uppercase tracking-[0.3em] pointer-events-none z-30">
          <ChevronLeft className="w-4 h-4 mb-1 animate-bounce rotate-90 opacity-50" />
          Swipe up to reply
      </div>
    </div>
  )
}
