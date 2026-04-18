'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { X, ChevronLeft, ChevronRight, Play, Pause, MoreVertical, Volume2, VolumeX, Loader2, Trash2, Eye, Send } from 'lucide-react'
import Image from 'next/image'
import { Status, useStatuses } from '@/hooks/useStatuses'
import { useAuth } from '@/context/AuthContext'
import { createClient } from '@/utils/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'

interface StatusViewerProps {
  statuses: Status[]
  onClose: () => void
  onDelete?: (id: string) => Promise<any>
  onInspectProfile?: (id: string) => void
  onMessageUser?: (id: string, name: string, avatar?: string) => void
}

export default function StatusViewer({ statuses, onClose, onDelete, onInspectProfile, onMessageUser }: StatusViewerProps) {
  const { user } = useAuth()
  const { fetchStatusViewers } = useStatuses()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isDeleting, setIsDeleting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [currentDuration, setCurrentDuration] = useState(5000) // Default 5s for images
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(true)
  const [isWaiting, setIsWaiting] = useState(false)
  const [isViewersOpen, setIsViewersOpen] = useState(false)
  const [viewers, setViewers] = useState<any[]>([])
  const [isLoadingViewers, setIsLoadingViewers] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  const currentStatus = statuses[currentIndex]

  // Reset loading states when index changes
  useEffect(() => {
    setIsLoadingMetadata(true)
    setIsWaiting(false)
    setIsPaused(false)
    setIsViewersOpen(false) // Close viewers when changing status

    // Increment impression count
    if (currentStatus?.id) {
      const supabase = createClient()
      supabase.rpc('increment_status_impressions', { p_status_id: currentStatus.id })
        .then(({ error }: { error: any }) => {
          if (error) {
            console.error("Error incrementing impressions:", JSON.stringify(error, null, 2))
          }
        })
    }
  }, [currentIndex, currentStatus?.id])

  // Sync video play/pause with isPaused state
  useEffect(() => {
    if (videoRef.current) {
      if (isPaused) {
        videoRef.current.pause()
      } else {
        // Only run play if the video is actually paused natively, to avoid AbortError spam which interrupts buffering
        if (videoRef.current.paused && currentStatus.content_type === 'video') {
          videoRef.current.play().catch(() => {})
        }
      }
    }
  }, [isPaused, currentStatus.content_type])

  const goToNext = useCallback(() => {
    if (currentIndex < statuses.length - 1) {
      setCurrentIndex(prev => prev + 1)
      setProgress(0)
      setCurrentDuration(5000) // Reset to standard 5s for the next item
    } else {
      onClose()
    }
  }, [currentIndex, statuses.length, onClose])

  const goToPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1)
      setProgress(0)
      setCurrentDuration(5000)
    }
  }

  const handleDelete = async () => {
    if (!onDelete || !currentStatus?.id || isDeleting) return
    if (!confirm('Are you sure you want to delete this initiative?')) return

    setIsDeleting(true)
    const res = await onDelete(currentStatus.id)
    setIsDeleting(false)

    if (res?.success) {
      // Transition to next or close
      if (statuses.length === 1) {
        onClose()
      } else {
        goToNext()
      }
    } else {
      alert(res?.error || 'Failed to delete initiative')
    }
  }

  // Handle video metadata loading to set correct duration
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      // Use video duration but cap at 30 seconds
      const vidDur = Math.min(videoRef.current.duration * 1000, 30000)
      setCurrentDuration(vidDur)
      setIsLoadingMetadata(false)
    }
  }

  useEffect(() => {
    // Basic guards: Pause if isPaused OR if the video is truly stuck
    // Note: We don't block the interval purely on isWaiting if readyState is sufficient
    const isActuallyStuck = isWaiting && videoRef.current && videoRef.current.readyState < 3
    
    if (isPaused || (currentStatus.content_type === 'video' && (isLoadingMetadata || isActuallyStuck))) return

    const intervalTime = 50 
    
    const timer = setInterval(() => {
      if (currentStatus.content_type === 'video' && videoRef.current) {
        // VIDEO MASTER CLOCK: Read direct from video time
        const vid = videoRef.current
        if (vid.duration) {
          const currentProgress = (vid.currentTime / vid.duration) * 100
          setProgress(currentProgress)
        }
      } else {
        // IMAGE TIMER: Manual step progression
        const step = (100 / (currentDuration / intervalTime))
        setProgress(prev => {
          if (prev >= 100) return 100
          return Math.min(prev + step, 100)
        })
      }
    }, intervalTime)

    return () => clearInterval(timer)
  }, [isPaused, isWaiting, isLoadingMetadata, currentDuration, currentStatus.content_type])

  useEffect(() => {
    if (progress >= 100) {
      goToNext()
    }
  }, [progress, goToNext])

  const handleOpenViewers = async () => {
    if (!currentStatus?.id || isDeleting) return
    setIsPaused(true)
    setIsViewersOpen(true)
    setIsLoadingViewers(true)
    const data = await fetchStatusViewers(currentStatus.id)
    setViewers(data || [])
    setIsLoadingViewers(false)
  }

  const handleCloseViewers = () => {
    setIsViewersOpen(false)
    setIsPaused(false)
  }

  const isOwner = currentStatus.user_id === user?.id

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
                <div className="w-full h-full bg-white/[0.06] flex items-center justify-center font-bold text-zinc-400">{currentStatus.user?.name?.[0]}</div>
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
            {isOwner && (
              <button 
                onClick={handleDelete} 
                className="p-2.5 hover:bg-red-500/20 rounded-full transition-colors backdrop-blur-md text-red-500"
                disabled={isDeleting}
                title="Delete Initiative"
              >
                {isDeleting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
              </button>
            )}
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
      <motion.div 
        className="absolute inset-0 z-10 flex items-center justify-center bg-black"
        onMouseDown={() => setIsPaused(true)}
        onMouseUp={() => !isViewersOpen && setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => !isViewersOpen && setIsPaused(false)}
      >
        {/* Navigation Overlays */}
        <div 
          className="absolute left-0 top-0 w-1/2 h-full cursor-pointer z-40 opacity-0" 
          onClick={goToPrev} 
        />
        <div 
          className="absolute right-0 top-0 w-1/2 h-full cursor-pointer z-40 opacity-0" 
          onClick={goToNext} 
        />

        {currentStatus.content_type === 'video' ? (
          <div className="relative w-full h-full flex items-center justify-center">
            {/* Show loading only if metadata missing or we are actively buffering */}
            {(isLoadingMetadata || isWaiting) && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm transition-opacity duration-300">
                <Loader2 className="w-12 h-12 text-white animate-spin opacity-80" />
              </div>
            )}
            <video 
              ref={videoRef}
              src={currentStatus.content_url} 
              autoPlay 
              muted={isMuted}
              playsInline
              preload="auto"
              loop={false}
              onLoadedMetadata={handleLoadedMetadata}
              onWaiting={() => setIsWaiting(true)}
              onCanPlay={() => setIsWaiting(false)}
              onCanPlayThrough={() => setIsWaiting(false)}
              onPlaying={() => {
                setIsWaiting(false)
                setIsLoadingMetadata(false)
              }}
              onEnded={goToNext}
              className="w-full h-full object-contain z-10"
            />
          </div>
        ) : (
          <div className="relative w-full h-full">
            <Image 
              src={currentStatus.content_url} 
              alt="Initiative" 
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
      </motion.div>

      {/* Footer Overlay / Interaction Bar */}
      {isOwner ? (
        <motion.div 
          className="absolute bottom-0 left-0 right-0 h-[40vh] bg-gradient-to-t from-black/95 via-black/40 to-transparent flex flex-col items-center justify-end pb-12 z-[320]"
          onPanEnd={(_, info) => {
            // High sensitivity swipe detection
            const isSwipeUp = info.offset.y < -40 || info.velocity.y < -150
            if (isSwipeUp) {
              handleOpenViewers()
            }
          }}
          onClick={(e) => {
            // Only trigger if clicking the container itself, not child buttons if they had their own handlers
            // But here we want the whole area to be clickable as a fallback
            if (e.target === e.currentTarget) handleOpenViewers()
          }}
        >
          <div className="flex flex-col items-center gap-1">
            <motion.div 
              className="flex items-center gap-1.5 cursor-pointer opacity-80 hover:opacity-100 transition-opacity"
              whileHover={{ scale: 1.05 }}
              onClick={(e) => {
                e.stopPropagation()
                handleOpenViewers()
              }}
            >
              <Eye className="w-4 h-4 text-white drop-shadow-md" />
              <span className="text-white font-bold text-sm drop-shadow-md">{currentStatus.impressions_count || 0}</span>
            </motion.div>
          </div>
        </motion.div>
      ) : (
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black/80 to-transparent flex flex-col items-center justify-center text-white/40 text-[9px] italic font-bold uppercase tracking-[0.3em] pointer-events-none z-30">
            <ChevronLeft className="w-4 h-4 mb-1 animate-bounce rotate-90 opacity-50" />
            Swipe up to reply
        </div>
      )}

      {/* Viewers Bottom Sheet */}
      <AnimatePresence>
        {isViewersOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCloseViewers}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm z-[400]"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute bottom-0 left-0 right-0 bg-[#0a0a0a] rounded-t-[2.5rem] border-t border-white/[0.08] z-[401] flex flex-col max-h-[70vh] shadow-[0_-20px_50px_rgba(0,0,0,0.5)]"
            >
              {/* Handle */}
              <div className="w-12 h-1 bg-white/10 rounded-full mx-auto mt-3 shrink-0" />
              
              <div className="p-6 pb-2 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white tracking-tight">Initiative Activity</h3>
                  <p className="text-xs text-zinc-500 mt-0.5">{currentStatus.impressions_count || 0} viewers so far</p>
                </div>
                <button 
                  onClick={handleCloseViewers}
                  className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-zinc-400 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-4 pb-10 custom-scrollbar mt-4">
                {isLoadingViewers ? (
                  <div className="py-20 flex flex-col items-center">
                    <Loader2 className="w-8 h-8 text-white/20 animate-spin" />
                  </div>
                ) : viewers.length === 0 ? (
                  <div className="py-20 text-center">
                    <div className="w-16 h-16 bg-white/[0.02] border border-white/[0.04] rounded-full flex items-center justify-center mx-auto mb-4">
                      <Eye className="w-6 h-6 text-zinc-700" />
                    </div>
                    <p className="text-zinc-600 text-sm italic">No viewers yet.</p>
                  </div>
                ) : (
                  <div className="space-y-px">
                    {viewers.map((viewer: any) => (
                      <div key={viewer.id} className="flex items-center gap-4 p-3 rounded-2xl hover:bg-white/[0.03] transition-colors group">
                        <div className="relative w-12 h-12 rounded-full overflow-hidden border border-white/[0.06] shrink-0 bg-white/[0.02]">
                          {viewer.avatar_url ? (
                            <Image src={viewer.avatar_url} alt={viewer.name} fill className="object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-white/[0.04] text-zinc-500 font-bold uppercase text-lg">
                              {viewer.name?.[0]}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-white font-bold text-sm truncate">{viewer.name}</h4>
                          <p className="text-zinc-600 text-[10px] uppercase font-bold tracking-wider mt-0.5">
                            Viewed {new Date(viewer.viewed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => {
                              handleCloseViewers()
                              onInspectProfile?.(viewer.id)
                            }}
                            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-bold text-white tracking-tight border border-white/5"
                          >
                            Inspect
                          </button>
                          <button 
                            onClick={() => {
                              handleCloseViewers()
                              onClose()
                              onMessageUser?.(viewer.id, viewer.name, viewer.avatar_url)
                            }}
                            className="p-2 bg-[#bc9dff]/10 hover:bg-[#bc9dff]/20 text-[#bc9dff] rounded-lg transition-colors border border-[#bc9dff]/10"
                            title="Message"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
