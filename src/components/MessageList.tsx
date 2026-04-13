'use client'

import { format } from 'date-fns'
import { Check, CheckCheck, FileText, PlayCircle, Reply, Forward, ChevronDown, X, Clock, Loader2, Download, ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import { motion, AnimatePresence, useAnimation, PanInfo } from 'framer-motion'

import CustomAudioPlayer from './CustomAudioPlayer'
import { useSettings } from '@/hooks/useSettings'

interface FlickerFreeMediaProps {
  url: string
  type: string
  className?: string
  onClick?: () => void
  controls?: boolean
}

function FlickerFreeMedia({ url, type, className, onClick, controls }: FlickerFreeMediaProps) {
  const [displayUrl, setDisplayUrl] = useState(url)
  const [isLoaded, setIsLoaded] = useState(false)
  const isBlob = url.startsWith('blob:')
  const nextUrlRef = useRef<string | null>(null)

  useEffect(() => {
    if (displayUrl.startsWith('blob:') && !url.startsWith('blob:')) {
      nextUrlRef.current = url
      const img = new window.Image()
      img.src = url
      img.onload = () => {
        setDisplayUrl(url)
        if (displayUrl.startsWith('blob:')) {
           URL.revokeObjectURL(displayUrl)
        }
      }
    } else {
      setDisplayUrl(url)
    }
  }, [url])

  if (type === 'video') {
    return (
      <div className="relative w-full h-full flex items-center justify-center bg-white/[0.02]">
        {!isLoaded && <div className="absolute inset-0 bg-white/[0.03] animate-pulse" />}
        <video 
          src={displayUrl} 
          onLoadedData={() => setIsLoaded(true)}
          controls={controls}
          className={`${className} ${!isLoaded ? 'opacity-0' : 'opacity-100'}`}
        />
      </div>
    )
  }

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-white/[0.02]">
      {!isLoaded && <div className="absolute inset-0 bg-white/[0.03] animate-pulse" />}
      <img 
        src={displayUrl} 
        alt="Media" 
        onLoad={() => setIsLoaded(true)}
        onClick={onClick}
        className={`${className} ${!isLoaded ? 'opacity-0' : 'opacity-100'}`} 
      />
    </div>
  )
}

interface Message {
  id: string
  content: string
  sender_id: string
  created_at: string
  status: 'sending' | 'sent' | 'delivered' | 'seen'
  media_url?: string
  media_type?: string
  reply_to?: string
  client_id?: string
  reply?: { id: string; content: string; sender_id: string } | null
  forwarded?: boolean
  is_deleted_everyone?: boolean
  deleted_for?: string[]
  is_system?: boolean
  sender?: { name: string; avatar_url: string | null }
}

interface MessageListProps {
  messages: Message[]
  loading?: boolean
  currentUserId: string
  otherUserAvatar?: string
  currentUserAvatar?: string
  isGroup?: boolean
  onReply: (message: Message) => void
  onForward: (message: Message) => void
  onDelete: (id: string, type: 'me' | 'everyone') => Promise<{ error: any }>
}

interface ImageAlbumProps {
  items: Message[]
  isOwn: boolean
  downloadedIds: Set<string>
  handleDownload: (id: string) => void
  currentUserAvatar?: string
  otherUserAvatar?: string
  onImageClick: (urls: string[], index: number) => void
}

function ImageAlbum({ items, isOwn, onImageClick, downloadedIds, handleDownload }: ImageAlbumProps) {
  const count = items.length
  const displayItems = items.slice(0, 4)
  const allUrls = items.map(m => m.media_url!)

  return (
    <div className={`grid gap-0.5 rounded-xl overflow-hidden max-w-[280px] bg-white/[0.03] ${
      count === 1 ? 'grid-cols-1' : 'grid-cols-2'
    }`}>
      {displayItems.map((msg, idx) => {
        const isLast = idx === 3 && count > 4
        const showOverlay = isLast
        const overlayCount = count - 3

        return (
          <div 
            key={msg.id} 
            className={`relative group/album item aspect-square overflow-hidden bg-white/[0.02] ${
              count === 3 && idx === 0 ? 'row-span-2 aspect-auto' : ''
            }`}
          >
            <FlickerFreeMedia 
              url={msg.media_url!} 
              type="image"
              className={`w-full h-full object-cover transition-all duration-300 hover:scale-105 cursor-pointer ${
                (!isOwn && !downloadedIds.has(msg.id)) ? 'blur-[20px] scale-110' : ''
              }`}
              onClick={() => {
                if (isOwn || downloadedIds.has(msg.id)) {
                  onImageClick(allUrls, idx)
                }
              }}
            />
            
            {showOverlay && (
              <div 
                className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center cursor-pointer"
                onClick={() => onImageClick(allUrls, idx)}
              >
                <span className="text-white font-bold text-xl">+{overlayCount}</span>
              </div>
            )}

            {!isOwn && !downloadedIds.has(msg.id) && !showOverlay && (
              <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/20">
                <button 
                  onClick={(e) => { e.stopPropagation(); handleDownload(msg.id); }}
                  className="bg-black/40 hover:bg-black/60 p-2 rounded-full backdrop-blur-md border border-white/10 transition-all"
                >
                  <Download className="w-4 h-4 text-white" />
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function MessageList({ messages, loading, currentUserId, otherUserAvatar, currentUserAvatar, isGroup, onReply, onForward, onDelete }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const isAtBottomRef = useRef(true)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [gallery, setGallery] = useState<{ urls: string[], index: number } | null>(null)
  const [videoPlayer, setVideoPlayer] = useState<string | null>(null)
  const [downloadedIds, setDownloadedIds] = useState<Set<string>>(new Set())
  const [menuAnchor, setMenuAnchor] = useState<{ id: string, x: number, y: number } | null>(null)
  
  const { settings, isLoaded } = useSettings()

  useEffect(() => {
    if (scrollRef.current && isAtBottomRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
      // 100px threshold for "near bottom"
      isAtBottomRef.current = scrollHeight - scrollTop - clientHeight < 100
    }
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    setMenuAnchor(null)
  }

  const handleOpenMenu = (e: React.MouseEvent | React.TouchEvent, id: string) => {
    e.preventDefault()
    let clientX, clientY
    if ('touches' in e) {
      clientX = e.touches[0].clientX
      clientY = e.touches[0].clientY
    } else {
      clientX = e.clientX
      clientY = e.clientY
    }
    setMenuAnchor({ id, x: clientX, y: clientY })
  }

  const processedMessages = useMemo(() => {
    const clusters: any[][] = []
    const filtered = messages.filter(m => {
      if (!currentUserId) return true
      return !m.deleted_for?.includes(currentUserId)
    })

    filtered.forEach((msg) => {
      const lastCluster = clusters[clusters.length - 1]
      const isGroupable = msg.media_type === 'image' && !msg.content && !msg.is_deleted_everyone && !msg.forwarded

      if (
        isGroupable && 
        lastCluster && 
        lastCluster[0].sender_id === msg.sender_id &&
        !lastCluster[0].forwarded &&
        (new Date(msg.created_at).getTime() - new Date(lastCluster[lastCluster.length - 1].created_at).getTime()) < 30000
      ) {
        lastCluster.push(msg)
      } else {
        clusters.push([msg])
      }
    })

    return clusters.flatMap(cluster => {
      if (cluster.length >= 5 && cluster.every(m => m.media_type === 'image' && !m.content)) {
        return [{
          ...cluster[cluster.length - 1],
          is_album: true,
          items: cluster,
          id: cluster[cluster.length - 1].id,
          client_id: cluster[0].client_id || cluster[0].id
        }]
      }
      return cluster
    })
  }, [messages, currentUserId])

  useEffect(() => {
    const saved = localStorage.getItem('connectly_downloaded_media')
    if (saved) {
      try {
        const ids = JSON.parse(saved)
        if (Array.isArray(ids)) setDownloadedIds(new Set(ids))
      } catch (e) {
        console.error("Error loading downloaded media state:", e)
      }
    }
  }, [])

  const handleDownload = (id: string) => {
    setDownloadedIds(prev => {
      const next = new Set(prev).add(id)
      localStorage.setItem('connectly_downloaded_media', JSON.stringify(Array.from(next)))
      return next
    })
  }

  // Handle gallery shortcuts
  useEffect(() => {
    if (!gallery) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        setGallery(prev => prev ? { ...prev, index: Math.max(0, prev.index - 1) } : null)
      } else if (e.key === 'ArrowRight') {
        setGallery(prev => prev ? { ...prev, index: Math.min(prev.urls.length - 1, prev.index + 1) } : null)
      } else if (e.key === 'Escape') {
        setGallery(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [gallery])

  const getSenderName = (senderId: string) => {
    return senderId === currentUserId ? 'You' : 'Them'
  }

  return (
    <div 
      ref={scrollRef} 
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto p-4 space-y-1.5 custom-scrollbar bg-transparent"
    >
      {loading ? (
        <div className="flex flex-col gap-4 py-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'} animate-pulse`}>
              <div className={`p-4 rounded-xl relative min-w-[120px] max-w-[200px] h-12 bg-white/[0.03] animate-skeleton ${i % 2 === 0 ? 'rounded-tr-none' : 'rounded-tl-none'}`}></div>
            </div>
          ))}
        </div>
      ) : messages.length === 0 ? (
        <div className="flex items-center justify-center h-full text-zinc-700 text-sm">
          Start a conversation...
        </div>
      ) : (
        processedMessages.map((message) => {
            const isOwn = !!currentUserId && message.sender_id === currentUserId
            const isHovered = hoveredId === message.id
            const swipeThreshold = 60
            const isAlbum = !!message.is_album

          return (
            <motion.div
              key={message.client_id || message.id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`flex w-full mb-1 ${message.is_system ? 'justify-center' : isOwn ? 'justify-end' : 'justify-start'} group items-start relative select-none`}
              onMouseEnter={() => !message.is_system && setHoveredId(message.id)}
              onMouseLeave={() => setHoveredId(null)}
              onContextMenu={(e) => !message.is_system && handleOpenMenu(e, message.id)}
            >
              {message.is_system ? (
                <div className="my-4 px-4 py-1.5 bg-white/[0.03] border border-white/[0.04] rounded-full">
                  <span className="text-zinc-500 text-[11px] font-bold tracking-wide uppercase">
                    {message.content}
                  </span>
                </div>
              ) : (
                <>
                  {/* Swipe to Reply Indicator */}
                  <div className="absolute left-[-40px] top-1/2 -translate-y-1/2 opacity-0 group-[.swiping]:opacity-100 transition-opacity">
                    <Reply className="w-5 h-5 text-zinc-500" />
                  </div>
                </>
              )}

              {!message.is_system && (
                <motion.div 
                  className={`relative max-w-[85%] sm:max-w-[75%] flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}
                  drag="x"
                  dragConstraints={{ left: 0, right: 100 }}
                  dragElastic={0.1}
                  onDrag={(e, info) => {
                    const target = e.currentTarget as HTMLElement | null;
                    if (info.offset.x > 10 && target?.parentElement) {
                      target.parentElement.classList.add('swiping')
                    }
                  }}
                  onDragEnd={(e, info) => {
                    const target = e.currentTarget as HTMLElement | null;
                    if (target?.parentElement) {
                      target.parentElement.classList.remove('swiping')
                    }
                    if (info.offset.x > swipeThreshold) {
                      onReply(message)
                    }
                  }}
                >
                {/* Hover Actions (Desktop) */}
                <div className={`hidden sm:flex absolute ${isOwn ? 'left-0 -translate-x-full' : 'right-0 translate-x-full'} top-1 items-center gap-0.5 px-1 transition-all duration-150 z-10 ${isHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                  <button 
                    onClick={() => onReply(message)} 
                    className="p-1.5 rounded-full bg-[#111] hover:bg-white/[0.08] text-zinc-600 hover:text-white transition-colors"
                  >
                    <Reply className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onClick={(e) => handleOpenMenu(e, message.id)} 
                    className="p-1.5 rounded-full bg-[#111] hover:bg-white/[0.08] text-zinc-600 hover:text-white transition-colors"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>
 
                 {/* Bubble */}
                 {(() => {
                   // Fallback detection for mislabeled audio files
                   const isAudio = message.media_type === 'audio' || 
                                  (message.media_url && (message.media_type === 'video' || message.media_type === 'file') && 
                                   ['mp3', 'wav', 'webm', 'ogg', 'm4a'].some(ext => message.media_url!.toLowerCase().includes(`.${ext}`)));

                   return (
                     <div
                       className={`rounded-2xl relative w-fit ${
                         message.is_deleted_everyone
                           ? 'p-3 min-w-[85px] bg-white/[0.02] italic'
                           : (message.media_type === 'image' || message.media_type === 'video' || message.is_album) && !message.content && !isAudio
                             ? isOwn
                               ? 'message-gradient rounded-br-[4px] overflow-hidden'
                               : 'bg-transparent rounded-bl-[4px] overflow-hidden'
                             : isAudio
                                ? isOwn
                                 ? 'message-gradient text-white rounded-br-[4px] p-0 min-w-[240px]'
                                 : 'bg-white/[0.04] backdrop-blur-md border border-white/[0.08] text-white rounded-bl-[4px] p-0 min-w-[240px]'
                             : message.media_type === 'file'
                                ? isOwn
                                 ? 'message-gradient text-white rounded-br-[4px] p-2'
                                 : 'bg-white/[0.04] backdrop-blur-md border border-white/[0.08] text-white rounded-bl-[4px] p-2'
                             : isOwn
                               ? 'p-3 min-w-[85px] message-gradient text-white rounded-br-[4px]'
                               : 'p-3 min-w-[85px] bg-[#1a1a1a] text-white rounded-bl-[4px]'
                        }`}
                       style={isOwn && !message.is_deleted_everyone ? {boxShadow:'0 4px 20px rgba(188,157,255,0.15)'} : undefined}
                       onContextMenu={(e) => handleOpenMenu(e, message.id)}
                     >
                       {/* Group Sender Info */}
                       {isGroup && !isOwn && !message.is_deleted_everyone && message.sender && (
                         <div className="flex items-center gap-1.5 px-1.5 pt-1.5 pb-0.5">
                           {message.sender.avatar_url ? (
                             <img src={message.sender.avatar_url} alt="" className="w-4 h-4 rounded-full object-cover shrink-0" />
                           ) : (
                             <div className="w-4 h-4 rounded-full primary-gradient flex items-center justify-center shrink-0">
                               <span className="text-[8px] font-bold text-white uppercase">{message.sender.name?.[0]}</span>
                             </div>
                           )}
                           <span className="text-[10px] font-bold tracking-wide" style={{color: '#bc9dff'}}>{message.sender.name}</span>
                         </div>
                       )}

                       {/* Forwarded */}
                       {message.forwarded && !message.is_deleted_everyone && (
                         <div className="flex items-center gap-1 px-1 pb-0.5">
                           <Forward className="w-3 h-3 text-white/30" />
                           <span className="text-[11px] text-white/30 italic">Forwarded</span>
                         </div>
                       )}

                       {/* Reply Preview */}
                       {message.reply && !message.is_deleted_everyone && (
                         <div className={`mx-1 mb-2 px-2.5 py-1.5 rounded-lg border-l-2 ${
                           isOwn 
                             ? 'bg-white/10 border-white/40' 
                             : 'bg-white/[0.04] border-[#bc9dff]'
                         }`}>
                           <p className="text-[11px] font-bold mb-0.5" style={{color: isOwn ? 'rgba(255,255,255,0.7)' : '#bc9dff'}}>
                             {message.reply.sender_id === currentUserId ? 'You' : 'Them'}
                           </p>
                           <p className="text-white/50 text-[12px] truncate leading-tight">
                             {message.reply.content || '📎 Media'}
                           </p>
                         </div>
                       )}

                       {/* Media */}
                       {(() => {
                         if (!((message.media_url && !message.is_album) || message.is_album) || message.is_deleted_everyone) return null;
                         
                         let effectiveMediaType = message.media_type;
                         if (message.media_url && (effectiveMediaType === 'video' || effectiveMediaType === 'file')) {
                           const url = message.media_url.toLowerCase();
                           if (url.includes('.mp3') || url.includes('.wav') || url.includes('.webm') || url.includes('.ogg') || url.includes('.m4a')) {
                             effectiveMediaType = 'audio';
                           }
                         }

                         return (
                           <div className="mb-1">
                             {message.is_album ? (
                               <ImageAlbum 
                                 items={message.items}
                                 isOwn={isOwn}
                                 onImageClick={(urls, index) => setGallery({ urls, index })}
                                 downloadedIds={downloadedIds}
                                 handleDownload={handleDownload}
                               />
                             ) : effectiveMediaType === 'image' && (
                               <div className="relative overflow-hidden group/media w-full">
                                 <FlickerFreeMedia 
                                   url={message.media_url!} 
                                   type="image"
                                   onClick={() => {
                                     if (isOwn || downloadedIds.has(message.id)) {
                                       setGallery({ urls: [message.media_url!], index: 0 })
                                     }
                                   }}
                                   className={`w-full max-h-[240px] object-cover transition-all duration-500 ${
                                     (!isOwn && !downloadedIds.has(message.id)) ? 'blur-[30px] scale-110 grayscale' : 
                                     (isOwn && message.status === 'sending') ? 'blur-[8px]' : 'cursor-pointer hover:opacity-95'
                                   }`} 
                                 />

                                 {isOwn && message.status === 'sending' && (
                                   <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 z-10 backdrop-blur-[2px]">
                                     <div className="bg-black/70 px-4 py-2.5 rounded-2xl backdrop-blur-sm flex flex-col items-center gap-1.5">
                                       <Loader2 className="w-6 h-6 text-white animate-spin" />
                                       {message.uploadPct != null && message.uploadPct > 0 && (
                                         <>
                                           <span className="text-white text-xs font-bold tabular-nums">{message.uploadPct}%</span>
                                           <div className="w-20 h-1 bg-white/20 rounded-full overflow-hidden">
                                             <div className="h-full bg-white rounded-full transition-all duration-300" style={{ width: `${message.uploadPct}%` }} />
                                           </div>
                                         </>
                                       )}
                                     </div>
                                   </div>
                                 )}

                                 {!isOwn && !downloadedIds.has(message.id) && (
                                   <div className="absolute inset-0 flex items-center justify-center z-10">
                                     <button 
                                       onClick={(e) => { e.stopPropagation(); handleDownload(message.id); }}
                                       className="bg-black/60 hover:bg-black/80 p-5 rounded-full backdrop-blur-md border border-white/20 transition-all transform hover:scale-110 shadow-2xl"
                                     >
                                       <div className="flex flex-col items-center gap-1">
                                         <Download className="w-8 h-8 text-white" />
                                         <span className="text-[10px] text-white/80 font-bold uppercase tracking-wider">Download</span>
                                       </div>
                                     </button>
                                   </div>
                                 )}
                               </div>
                             )}
                             {effectiveMediaType === 'video' && (
                               <div className="relative rounded-xl overflow-hidden bg-black group/media" style={{maxWidth:280}}>
                                 {/* Clickable thumbnail with play overlay */}
                                     <div
                                       className={`relative ${(isOwn || downloadedIds.has(message.id)) && message.status !== 'sending' ? 'cursor-pointer' : ''}`}
                                       onPointerDown={(e) => e.stopPropagation()}
                                       onClick={(e) => {
                                         e.preventDefault()
                                         e.stopPropagation()
                                         if ((isOwn || downloadedIds.has(message.id)) && message.status !== 'sending') {
                                           setVideoPlayer(message.media_url!)
                                         }
                                       }}
                                     >
                                   <video
                                     src={message.media_url!}
                                     className={`w-full max-h-[240px] object-cover transition-all duration-500 ${
                                       (!isOwn && !downloadedIds.has(message.id)) ? 'blur-[30px] scale-110 grayscale' :
                                       (isOwn && message.status === 'sending') ? 'blur-[8px]' : ''
                                     }`}
                                     preload="metadata"
                                     muted
                                     playsInline
                                   />
                                     {/* Play button overlay */}
                                     {(isOwn || downloadedIds.has(message.id)) && message.status !== 'sending' && (
                                       <div 
                                         className="absolute inset-0 z-[25] flex items-center justify-center bg-black/30 hover:bg-black/20 transition-all cursor-pointer"
                                         onPointerDown={(e) => e.stopPropagation()}
                                         onClick={(e) => {
                                           e.preventDefault();
                                           e.stopPropagation();
                                           setVideoPlayer(message.media_url!);
                                         }}
                                       >
                                         <div className="w-14 h-14 rounded-full bg-black/60 backdrop-blur-md border border-white/25 flex items-center justify-center shadow-2xl transition-transform duration-200 pointer-events-none">
                                           <PlayCircle className="w-8 h-8 text-white" />
                                         </div>
                                       </div>
                                     )}
                                 </div>

                                 {/* Upload progress */}
                                 {isOwn && message.status === 'sending' && (
                                   <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 z-10 backdrop-blur-[2px]">
                                     <div className="bg-black/70 px-4 py-2.5 rounded-2xl backdrop-blur-sm flex flex-col items-center gap-1.5">
                                       <Loader2 className="w-6 h-6 text-white animate-spin" />
                                       {message.uploadPct != null && message.uploadPct > 0 && (
                                         <>
                                           <span className="text-white text-xs font-bold tabular-nums">{message.uploadPct}%</span>
                                           <div className="w-20 h-1 bg-white/20 rounded-full overflow-hidden">
                                             <div className="h-full bg-white rounded-full transition-all duration-300" style={{ width: `${message.uploadPct}%` }} />
                                           </div>
                                         </>
                                       )}
                                     </div>
                                   </div>
                                 )}

                                 {/* Download gate for received videos */}
                                 {!isOwn && !downloadedIds.has(message.id) && (
                                   <div className="absolute inset-0 flex items-center justify-center z-10">
                                     <button
                                       onClick={(e) => { e.stopPropagation(); handleDownload(message.id); }}
                                       className="bg-black/60 hover:bg-black/80 p-5 rounded-full backdrop-blur-md border border-white/20 transition-all transform hover:scale-110 shadow-2xl"
                                     >
                                       <div className="flex flex-col items-center gap-1">
                                         <Download className="w-8 h-8 text-white" />
                                         <span className="text-[10px] text-white/80 font-bold uppercase tracking-wider">Tap to view</span>
                                       </div>
                                     </button>
                                   </div>
                                 )}
                               </div>
                             )}
                             {effectiveMediaType === 'audio' && (
                               <div className="relative">
                                 {message.status === 'sending' && (
                                   <div className="absolute inset-0 bg-white/[0.02] backdrop-blur-[1px] flex items-center justify-center z-10 rounded-lg">
                                      <Loader2 className="w-6 h-6 text-white animate-spin" />
                                   </div>
                                 )}
                                 <CustomAudioPlayer 
                                   src={message.media_url} 
                                   isOwn={isOwn} 
                                   avatarUrl={isOwn ? currentUserAvatar : otherUserAvatar} 
                                   createdAt={message.created_at}
                                   status={message.status}
                                 />
                               </div>
                             )}
                             {effectiveMediaType === 'file' && (
                               <div className={`flex items-center gap-3 p-3 rounded-xl border ${
                                 isOwn ? 'bg-white/10 border-white/20' : 'bg-white/5 border-white/10'
                               } min-w-[220px]`}>
                                 <div className={`p-2 rounded-lg ${
                                   message.media_url.toLowerCase().endsWith('.pdf') ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'
                                 }`}>
                                   <FileText className="w-6 h-6" />
                                 </div>
                                 <div className="flex-1 min-w-0">
                                   <p className="text-[13px] font-medium text-white truncate">
                                     {message.media_url.split('/').pop()?.split('?')[0] || 'Document'}
                                   </p>
                                   <p className="text-[10px] text-white/40 uppercase tracking-tighter">
                                     {message.media_url.toLowerCase().endsWith('.pdf') ? 'PDF Document' : 'File'}
                                   </p>
                                 </div>
                                 <a 
                                   href={message.media_url} 
                                   download 
                                   target="_blank" 
                                   rel="noopener noreferrer"
                                   className="p-2 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                                 >
                                   <Download className="w-4 h-4" />
                                 </a>
                               </div>
                             )}
                           </div>
                         );
                       })()}

                       {/* Content & Footer */}
                       <div className="flex flex-col relative min-w-0">
                         {message.is_deleted_everyone ? (
                           <p className="text-white/20 text-xs px-1 flex items-center gap-2 pb-1.5">
                             <X className="w-3 h-3" /> This message was deleted
                           </p>
                         ) : message.content && (
                           <p className={`px-1 leading-relaxed whitespace-pre-wrap break-all pb-4 overflow-hidden ${
                             !isLoaded || settings.textSize === 'medium' ? 'text-[14.5px]' : settings.textSize === 'small' ? 'text-[13px]' : 'text-[16px]'
                           }`}>
                             {message.content}
                           </p>
                         )}

                         {!isAudio && (
                           <div className={`flex items-center gap-1.5 absolute bottom-0 right-0 ${message.media_url && !message.content ? 'bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded-full ring-1 ring-white/10' : ''}`}>
                             <span className="text-[10px] text-white/40 tabular-nums lowercase select-none whitespace-nowrap">
                               {format(new Date(message.created_at), 'h:mm a')}
                             </span>
                             {isOwn && (
                               <div className="flex items-center">
                                 {message.status === 'sending' ? (
                                   <Clock className="w-3 h-3 text-white/30 animate-pulse" />
                                 ) : message.status === 'sent' ? (
                                   <Check className="w-3.5 h-3.5 text-white/40" />
                                 ) : message.status === 'delivered' ? (
                                   <CheckCheck className="w-4 h-4 text-white/50" />
                                 ) : (
                                   <CheckCheck className="w-4 h-4 text-[#3b82f6]" />
                                 )}
                               </div>
                             )}
                           </div>
                         )}
                       </div>
                     </div>
                    );
                  })()}
                </motion.div>
              )}
            </motion.div>
          );
        })
      )}

      {/* Message Action Menu */}
      {menuAnchor && typeof document !== 'undefined' && createPortal(
        <>
          <div className="fixed inset-0 z-[1000]" onClick={() => setMenuAnchor(null)} />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="fixed z-[1001] bg-[#1a1a1a] border border-white/[0.06] rounded-2xl shadow-2xl py-1.5 min-w-[180px] overflow-hidden"
            style={{ 
              top: Math.min(menuAnchor.y, typeof window !== 'undefined' ? window.innerHeight - 260 : menuAnchor.y), 
              left: Math.min(menuAnchor.x, typeof window !== 'undefined' ? window.innerWidth - 195 : menuAnchor.x),
              boxShadow: '0 16px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(188,157,255,0.06)'
            }}
          >
            <button 
              onClick={() => {
                const msg = messages.find(m => m.id === menuAnchor.id)
                if (msg) onReply(msg)
                setMenuAnchor(null)
              }}
              className="w-full flex items-center gap-3 px-4 py-2 text-[13px] text-zinc-300 hover:bg-white/5 transition-colors"
            >
              <Reply className="w-4 h-4" /> Reply
            </button>
            <button 
              onClick={() => {
                const msg = messages.find(m => m.id === menuAnchor.id)
                if (msg) handleCopy(msg.content)
              }}
              className="w-full flex items-center gap-3 px-4 py-2 text-[13px] text-zinc-300 hover:bg-white/5 transition-colors"
            >
              <Check className="w-4 h-4" /> Copy
            </button>
            <button 
              onClick={() => {
                const msg = messages.find(m => m.id === menuAnchor.id)
                if (msg) { onForward(msg); setMenuAnchor(null); }
              }}
              className="w-full flex items-center gap-3 px-4 py-2 text-[13px] text-zinc-300 hover:bg-white/5 transition-colors"
            >
              <Forward className="w-4 h-4" /> Forward
            </button>
            <div className="h-[1px] bg-white/5 my-1" />
            <button 
              onClick={async () => {
                await onDelete(menuAnchor.id, 'me')
                setMenuAnchor(null)
              }}
              className="w-full flex items-center gap-3 px-4 py-2 text-[13px] text-red-400 hover:bg-red-400/5 transition-colors"
            >
              <X className="w-4 h-4" /> Delete for me
            </button>
            {messages.find(m => m.id === menuAnchor.id)?.sender_id === currentUserId && (
              <button 
                onClick={async () => {
                  await onDelete(menuAnchor.id, 'everyone')
                  setMenuAnchor(null)
                }}
                className="w-full flex items-center gap-3 px-4 py-2 text-[13px] text-red-400 hover:bg-red-400/5 transition-colors"
              >
                <X className="w-4 h-4" /> Delete for everyone
              </button>
            )}
          </motion.div>
        </>,
        document.body
      )}

      {/* Fullscreen Gallery (Images) */}
      {gallery && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setGallery(null)}
        >
           <button 
             className="absolute top-6 right-6 z-[10000] p-3 text-white/60 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-all"
             onClick={() => setGallery(null)}
           >
             <X className="w-6 h-6" />
           </button>

           {gallery.urls.length > 1 && (
             <>
               <button 
                disabled={gallery.index === 0}
                onClick={(e) => {
                  e.stopPropagation()
                  setGallery(prev => prev ? { ...prev, index: Math.max(0, prev.index - 1) } : null)
                }}
                className={`absolute left-6 z-[10000] p-4 text-white/60 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-all ${gallery.index === 0 ? 'opacity-20 cursor-not-allowed' : ''}`}
               >
                 <ChevronLeft className="w-8 h-8" />
               </button>
               <button 
                disabled={gallery.index === gallery.urls.length - 1}
                onClick={(e) => {
                  e.stopPropagation()
                  setGallery(prev => prev ? { ...prev, index: Math.min(prev.urls.length - 1, prev.index + 1) } : null)
                }}
                className={`absolute right-6 z-[10000] p-4 text-white/60 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-all ${gallery.index === gallery.urls.length - 1 ? 'opacity-20 cursor-not-allowed' : ''}`}
               >
                 <ChevronRight className="w-8 h-8" />
               </button>
               
               <div className="absolute bottom-10 left-1/2 -translate-x-1/2 text-white/60 text-sm font-medium bg-white/5 px-4 py-1.5 rounded-full backdrop-blur-md">
                 {gallery.index + 1} / {gallery.urls.length}
               </div>
             </>
           )}

           <div className="relative w-full h-full flex items-center justify-center p-8 overflow-hidden" onClick={e => e.stopPropagation()}>
             <AnimatePresence mode="wait">
               <motion.img 
                 key={gallery.urls[gallery.index]}
                 src={gallery.urls[gallery.index]} 
                 initial={{ opacity: 0, scale: 0.95, x: 20 }}
                 animate={{ opacity: 1, scale: 1, x: 0 }}
                 exit={{ opacity: 0, scale: 1.05, x: -20 }}
                 transition={{ duration: 0.25, ease: "easeOut" }}
                 alt="Fullscreen media" 
                 className="max-w-full max-h-full object-contain select-none rounded-lg shadow-2xl"
               />
             </AnimatePresence>
           </div>
        </div>,
        document.body
      )}

      {/* Fullscreen Video Player */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {videoPlayer && (
            <motion.div
              key="video-modal"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[9999] bg-black flex flex-col"
              onClick={() => setVideoPlayer(null)}
            >
              {/* Top bar */}
              <div className="flex items-center justify-between px-4 py-3 z-10 flex-shrink-0" style={{background:'linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, transparent 100%)'}}>
                <button
                  onClick={() => setVideoPlayer(null)}
                  className="p-2.5 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all backdrop-blur-md"
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-2">
                  <a
                    href={videoPlayer}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="p-2.5 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all backdrop-blur-md"
                  >
                    <Download className="w-5 h-5" />
                  </a>
                </div>
              </div>

              {/* Video */}
              <div className="flex-1 flex items-center justify-center px-2 pb-4" onClick={e => e.stopPropagation()}>
                <motion.video
                  key={videoPlayer}
                  src={videoPlayer}
                  initial={{ scale: 0.92, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  autoPlay
                  controls
                  playsInline
                  className="w-full max-h-[85dvh] rounded-xl object-contain shadow-2xl"
                  style={{ outline: 'none' }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  )
}
