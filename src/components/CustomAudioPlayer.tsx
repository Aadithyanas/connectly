import { useState, useRef, useEffect, useMemo } from 'react'
import { Play, Pause, User, Mic } from 'lucide-react'
import Image from 'next/image'

interface CustomAudioPlayerProps {
  src: string
  isOwn: boolean
  avatarUrl?: string
}

const getWaveform = (src: string) => {
  let hash = 0
  for (let i = 0; i < src.length; i++) {
    hash = src.charCodeAt(i) + ((hash << 5) - hash)
  }
  
  const bars = []
  for (let i = 0; i < 40; i++) {
    const sin1 = Math.abs(Math.sin(hash + i * 0.5)) * 10
    const sin2 = Math.abs(Math.cos(hash + i * 1.2)) * 15
    const noise = (Math.abs(Math.sin(hash * i)) * 5)
    let height = Math.floor(sin1 + sin2 + noise + 2)
    if (i < 3 || i > 37) height = height * 0.4
    if (i < 6 || i > 34) height = height * 0.7
    bars.push(Math.max(3, Math.min(22, height)))
  }
  return bars
}

export default function CustomAudioPlayer({ src, isOwn, avatarUrl }: CustomAudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  
  const waveform = useMemo(() => getWaveform(src), [src])

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

  const togglePlayPause = () => {
    if (!audioRef.current) return
    if (isPlaying) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
    }
    setIsPlaying(!isPlaying)
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value)
    if (audioRef.current) {
      audioRef.current.currentTime = time
      setCurrentTime(time)
    }
  }

  const formatTime = (timeInSeconds: number) => {
    if (isNaN(timeInSeconds) || timeInSeconds === Infinity) return "0:00"
    const m = Math.floor(timeInSeconds / 60)
    const s = Math.floor(timeInSeconds % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0
  
  // Colors based on WhatsApp Dark Mode
  const activeColor = isOwn ? '#53bdeb' : '#00a884'
  const inactiveColorClass = isOwn ? 'bg-[#e9edef]/40' : 'bg-[#8696a0]/50'

  return (
    <div className="flex items-center gap-3 p-1 min-w-[240px] max-w-[320px]">
      <button 
        onClick={togglePlayPause} 
        className="p-2 hover:bg-black/10 rounded-full transition-colors flex shrink-0"
      >
        {isPlaying ? (
          <Pause className="w-6 h-6 fill-current text-[#aebac1]" />
        ) : (
          <Play className="w-6 h-6 fill-current text-[#aebac1] ml-0.5" />
        )}
      </button>

      <div className="flex-1 flex flex-col justify-center gap-1 min-w-[140px] mx-1">
        {/* Waveform Progress Bar */}
        <div className="relative w-full h-10 flex items-center justify-between group cursor-pointer gap-[2px]">
           {waveform.map((h, i) => {
             const barPercent = (i / waveform.length) * 100
             const isPlayed = progress >= barPercent
             return (
               <div 
                 key={i} 
                 className={`w-[3px] rounded-full transition-colors ${!isPlayed ? inactiveColorClass : ''}`} 
                 style={{ height: `${h}px`, backgroundColor: isPlayed ? activeColor : undefined }} 
               />
             )
           })}
           
           <input 
            type="range" 
            min="0" 
            max={duration || 100} 
            value={currentTime} 
            onChange={handleSeek}
            className="w-full absolute z-10 opacity-0 cursor-pointer h-full" 
          />
          {/* Audio Knob */}
          <div 
            className="w-3.5 h-3.5 rounded-full absolute z-10 top-1/2 -translate-y-1/2 shadow-sm pointer-events-none transition-all"
            style={{ left: `calc(${progress}% - 7px)`, backgroundColor: activeColor }}
          ></div>
        </div>

        <div className="flex items-center justify-between -mt-1">
          <span className="text-[11px] text-[#e9edef]/60 tabular-nums font-medium">
            {formatTime(currentTime > 0 ? currentTime : duration)}
          </span>
        </div>
      </div>

      <div className="relative flex shrink-0 ml-2">
        <div className="w-11 h-11 rounded-full bg-[#374248] flex items-center justify-center overflow-hidden border border-black/10">
          {avatarUrl ? (
            <Image src={avatarUrl} alt="Avatar" width={44} height={44} className="object-cover" />
          ) : (
            <User className="w-6 h-6 text-[#8696a0]" />
          )}
        </div>
        <div className="absolute -bottom-1 -left-1 text-white z-10 w-4 h-4 bg-[currentColor] rounded-full flex items-center justify-center border border-[#111b21]" style={{ color: activeColor }}>
           <Mic className="w-2.5 h-2.5 text-[#111b21]" />
        </div>
      </div>
    </div>
  )
}
