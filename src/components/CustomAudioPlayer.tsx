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
    const sin1 = Math.abs(Math.sin(hash + i * 0.5)) * 6
    const sin2 = Math.abs(Math.cos(hash + i * 1.2)) * 8
    const noise = (Math.abs(Math.sin(hash * i)) * 3)
    let height = Math.floor(sin1 + sin2 + noise + 2)
    if (i < 3 || i > 37) height = height * 0.4
    if (i < 6 || i > 34) height = height * 0.7
    bars.push(Math.max(2, Math.min(14, height)))
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
  
  const activeColor = '#ffffff'
  const inactiveColorClass = 'bg-white/20'

  return (
    <div className="flex items-center gap-1.5 px-2 py-1.5 w-full" style={{minWidth:'170px', maxWidth:'220px'}}>
      {/* Play button */}
      <button 
        onClick={togglePlayPause} 
        className="p-1 hover:bg-white/5 rounded-full transition-colors flex shrink-0"
      >
        {isPlaying ? (
          <Pause className="w-3.5 h-3.5 fill-current text-white/80" />
        ) : (
          <Play className="w-3.5 h-3.5 fill-current text-white/80 ml-0.5" />
        )}
      </button>

      {/* Waveform + time stacked */}
      <div className="flex-1 flex flex-col justify-center min-w-0">
        {/* Bars — centered vertically */}
        <div className="relative w-full flex items-center" style={{height:'20px'}}>
           <div className="absolute inset-0 flex items-center justify-between">
             {waveform.map((h, i) => {
               if (i % 2 !== 0) return null
               const barPercent = (i / waveform.length) * 100
               const isPlayed = progress >= barPercent
               return (
                 <div 
                   key={i} 
                   className={`w-[2px] rounded-full transition-colors flex-shrink-0 ${!isPlayed ? inactiveColorClass : ''}`} 
                   style={{ height: `${h}px`, backgroundColor: isPlayed ? activeColor : undefined }} 
                 />
               )
             })}
           </div>
           {/* Scrub dot */}
           <div 
             className="w-2 h-2 rounded-full absolute z-10 top-1/2 -translate-y-1/2 pointer-events-none bg-white shadow"
             style={{ left: `calc(${progress}% - 4px)` }}
           />
           {/* Transparent range input for seeking */}
           <input 
             type="range" 
             min="0" 
             max={duration || 100} 
             value={currentTime} 
             onChange={handleSeek}
             className="absolute inset-0 w-full opacity-0 cursor-pointer" 
           />
        </div>
        {/* Duration */}
        <span className="text-[8px] text-white/35 tabular-nums font-medium mt-0.5">
          {formatTime(currentTime > 0 ? currentTime : duration)}
        </span>
      </div>

      {/* Avatar */}
      <div className="relative flex shrink-0 ml-0.5">
        <div className="w-6 h-6 rounded-full bg-white/[0.06] flex items-center justify-center overflow-hidden border border-white/[0.06]">
          {avatarUrl ? (
            <Image src={avatarUrl} alt="Avatar" width={24} height={24} className="object-cover" />
          ) : (
            <User className="w-3.5 h-3.5 text-zinc-600" />
          )}
        </div>
        <div className="absolute -bottom-0.5 -left-0.5 w-2.5 h-2.5 bg-white rounded-full flex items-center justify-center border border-black">
           <Mic className="w-1 h-1 text-black" />
        </div>
      </div>
    </div>
  )
}
