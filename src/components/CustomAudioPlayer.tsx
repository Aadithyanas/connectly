import { useState, useRef, useEffect, useMemo } from 'react'
import { Play, Pause, User, Mic, Check, CheckCheck, Clock } from 'lucide-react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'

interface CustomAudioPlayerProps {
  src: string
  isOwn: boolean
  avatarUrl?: string
  createdAt?: string
  status?: 'sending' | 'sent' | 'delivered' | 'seen'
}

// Higher density waveform generator - Refined for smoother look
const getWaveform = (src: string) => {
  let hash = 0
  for (let i = 0; i < src.length; i++) {
    hash = src.charCodeAt(i) + ((hash << 5) - hash)
  }
  
  const bars = []
  const barCount = 70 // Increased density
  for (let i = 0; i < barCount; i++) {
    const noise = Math.abs(Math.sin(hash * i * 0.15)) * 6
    const wave = Math.abs(Math.cos(i * 0.25)) * 8
    let height = Math.floor(noise + wave + 4)
    
    // Taper ends
    if (i < 8) height *= (i / 8)
    if (i > barCount - 9) height *= ((barCount - i) / 8)
    
    // Add micro-randomness for organic feel
    height += Math.random() * 2
    
    bars.push(Math.max(2, Math.min(22, height)))
  }
  return bars
}

export default function CustomAudioPlayer({ src, isOwn, avatarUrl, createdAt, status }: CustomAudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  
  const waveform = useMemo(() => getWaveform(src), [src])
  
  // Format the message timestamp if provided
  const messageTime = useMemo(() => {
    if (!createdAt) return null
    try {
      const date = new Date(createdAt)
      return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase()
    } catch (e) {
      return null
    }
  }, [createdAt])

  useEffect(() => {
    const audio = new Audio(src)
    audioRef.current = audio

    const setAudioData = () => {
      if (audio.duration && audio.duration !== Infinity) {
        setDuration(audio.duration)
      }
    }

    const setAudioTime = () => setCurrentTime(audio.currentTime)
    const onEnded = () => {
      setIsPlaying(false)
      setCurrentTime(0)
    }

    audio.addEventListener('loadedmetadata', setAudioData)
    audio.addEventListener('durationchange', setAudioData)
    audio.addEventListener('timeupdate', setAudioTime)
    audio.addEventListener('ended', onEnded)

    return () => {
      audio.removeEventListener('loadedmetadata', setAudioData)
      audio.removeEventListener('durationchange', setAudioData)
      audio.removeEventListener('timeupdate', setAudioTime)
      audio.removeEventListener('ended', onEnded)
      audio.pause()
      audio.src = ''
    }
  }, [src])

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackSpeed
    }
  }, [playbackSpeed])

  const togglePlayPause = () => {
    if (!audioRef.current) return
    if (isPlaying) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
    }
    setIsPlaying(!isPlaying)
  }

  const toggleSpeed = () => {
    const nextSpeed = playbackSpeed === 1 ? 1.5 : playbackSpeed === 1.5 ? 2 : 1
    setPlaybackSpeed(nextSpeed)
  }

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const clickedProgress = x / rect.width
    const newTime = clickedProgress * duration
    audioRef.current.currentTime = newTime
    setCurrentTime(newTime)
  }

  const formatTime = (timeInSeconds: number) => {
    if (isNaN(timeInSeconds) || timeInSeconds === Infinity) return "0:00"
    const m = Math.floor(timeInSeconds / 60)
    const s = Math.floor(timeInSeconds % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0
  
  return (
    <div className="flex items-start gap-2 p-1.5 w-full select-none" style={{ minWidth: '240px' }}>
      {/* Play/Pause Button - Compact & Sleek */}
      <button 
        onClick={togglePlayPause} 
        className="mt-0.5 w-10 h-10 flex items-center justify-center hover:bg-white/10 rounded-full transition-all shrink-0 group active:scale-90"
      >
        {isPlaying ? (
          <Pause className="w-6 h-6 fill-white text-white drop-shadow-md" />
        ) : (
          <Play className="w-6 h-6 fill-white text-white ml-1 drop-shadow-md" />
        )}
      </button>

      {/* Center Logic: Waveform + Metadata Row */}
      <div className="flex-1 min-w-0 pt-0.5">
        <div 
          className="relative h-8 flex items-center cursor-pointer group/wave"
          onClick={handleSeek}
        >
          {/* Waveform Bars - Slightly shorter for compact look */}
          <div className="flex items-center justify-between w-full h-full gap-[1.5px]">
            {waveform.map((h, i) => {
              const barPercent = (i / waveform.length) * 100
              const isPlayed = progress >= barPercent
              
              return (
                <div 
                  key={i} 
                  className="flex-1 min-w-[1px] rounded-full transition-all duration-300" 
                  style={{ 
                    height: `${Math.max(2, (h / 22) * 16)}px`, 
                    backgroundColor: isPlayed ? '#fff' : 'rgba(255,255,255,0.2)',
                    opacity: isPlayed ? 1 : 0.4
                  }} 
                />
              )
            })}
          </div>

          {/* COMPACT BLUE HANDLE DOT */}
          <div 
            className="absolute w-3 h-3 bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.4)] z-20 pointer-events-none transition-transform duration-100"
            style={{ 
              left: `${progress}%`,
              transform: `translateX(-50%)`
            }}
          />
        </div>

        {/* Info Row: Progress Time + Speed Button */}
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-[10px] text-white/60 font-medium tabular-nums">
            {formatTime(currentTime || 0)}
          </span>
          
          <button 
            onClick={toggleSpeed}
            className="bg-black/20 hover:bg-black/30 backdrop-blur-sm text-white/80 text-[9px] font-bold w-9 h-5 rounded-full border border-white/10 transition-all flex items-center justify-center"
          >
            {playbackSpeed}X
          </button>
        </div>
      </div>

      {/* Right Section: Avatar + Message Timestamp BELOW it */}
      <div className="flex flex-col items-center gap-1 shrink-0 ml-1">
        <div className="relative">
          <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center overflow-hidden border border-white/20 ring-1 ring-black/20 shadow-lg">
            {avatarUrl ? (
              <Image src={avatarUrl} alt="Avatar" width={36} height={36} className="object-cover" />
            ) : (
              <User className="w-5 h-5 text-zinc-600" />
            )}
          </div>
          
          {/* Floating Mic Badge - Smaller */}
          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-white rounded-full flex items-center justify-center border border-[#121212] shadow-md z-10">
             <Mic className={`w-2 h-2 ${isPlaying ? 'text-blue-500 animate-pulse' : 'text-zinc-500'}`} />
          </div>
        </div>
        
        {/* Message Timestamp + Ticks - More compact */}
        <div className="flex items-center gap-1">
          {messageTime && (
            <span className="text-[9px] text-white/50 font-medium whitespace-nowrap lowercase">
              {messageTime}
            </span>
          )}
          
          {isOwn && status && (
            <div className="flex items-center">
              {status === 'sending' ? (
                <Clock className="w-2 h-2 text-white/40 animate-pulse" />
              ) : status === 'sent' ? (
                <Check className="w-2.5 h-2.5 text-white/40" />
              ) : status === 'delivered' ? (
                <CheckCheck className="w-3 h-3 text-white/40" />
              ) : (
                <CheckCheck className="w-3 h-3 text-[#3b82f6]" />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

