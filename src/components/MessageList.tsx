'use client'

import { format } from 'date-fns'
import { Check, CheckCheck, FileText, PlayCircle, Reply, Forward, ChevronDown, X, Clock, Loader2, Download } from 'lucide-react'
import { useEffect, useRef, useState, useCallback } from 'react'
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
}

interface MessageListProps {
  messages: Message[]
  loading?: boolean
  currentUserId: string
  otherUserAvatar?: string
  currentUserAvatar?: string
  onReply: (message: Message) => void
  onForward: (message: Message) => void
  onDelete: (id: string, type: 'me' | 'everyone') => Promise<{ error: any }>
}

export default function MessageList({ messages, loading, currentUserId, otherUserAvatar, currentUserAvatar, onReply, onForward, onDelete }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const isAtBottomRef = useRef(true)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null)
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
        messages.map((message) => {
          const isOwn = message.sender_id === currentUserId
          const isHovered = hoveredId === message.id
          const swipeThreshold = 60

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
                <div
                  className={`p-2.5 rounded-2xl relative w-fit min-w-[85px] border ${
                    message.is_deleted_everyone 
                      ? 'bg-white/[0.02] border-white/[0.02] italic' 
                      : isOwn ? 'bg-[#1a1a1a] text-white border-white/[0.06] rounded-br-[4px]' : 'bg-white/[0.04] text-white border-white/[0.04] rounded-bl-[4px]'
                   }`}
                   onContextMenu={(e) => handleOpenMenu(e, message.id)}
                >
                  {/* Forwarded */}
                  {message.forwarded && !message.is_deleted_everyone && (
                    <div className="flex items-center gap-1 px-1 pb-0.5">
                      <Forward className="w-3 h-3 text-white/30" />
                      <span className="text-[11px] text-white/30 italic">Forwarded</span>
                    </div>
                  )}

                  {/* Reply Preview */}
                  {message.reply && !message.is_deleted_everyone && (
                    <div className={`mx-1 mb-1 px-2.5 py-1.5 rounded-lg border-l-2 ${isOwn ? 'bg-white/[0.06] border-zinc-500' : 'bg-white/[0.04] border-zinc-600'}`}>
                      <p className="text-zinc-400 text-[11px] font-bold mb-0.5">
                        {message.reply.sender_id === currentUserId ? 'You' : 'Them'}
                      </p>
                      <p className="text-white/50 text-[12px] truncate leading-tight">
                        {message.reply.content || '📎 Media'}
                      </p>
                    </div>
                  )}

                  {/* Media */}
                  {message.media_url && !message.is_deleted_everyone && (
                    <div className="mb-1">
                      {message.media_type === 'image' && (
                        <div className="relative rounded-lg overflow-hidden flex items-center justify-center bg-black/10 group/media">
                          <FlickerFreeMedia 
                            url={message.media_url} 
                            type={message.media_type || 'image'}
                            onClick={() => {
                              if (isOwn || downloadedIds.has(message.id)) {
                                setFullscreenImage(message.media_url as string)
                              }
                            }}
                            className={`max-w-full max-h-[350px] w-auto h-auto object-contain rounded-lg transition-all duration-500 ${
                              (!isOwn && !downloadedIds.has(message.id)) ? 'blur-[30px] scale-110 grayscale' : 
                              (isOwn && message.status === 'sending') ? 'blur-[8px]' : 'cursor-pointer hover:opacity-95'
                            }`} 
                          />

                          {isOwn && message.status === 'sending' && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20 z-10">
                              <div className="bg-black/60 p-3 rounded-full backdrop-blur-sm">
                                <Loader2 className="w-8 h-8 text-white animate-spin" />
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
                      {message.media_type === 'video' && (
                        <div className="relative rounded-lg overflow-hidden flex items-center justify-center bg-black/10 group/media">
                          <FlickerFreeMedia 
                            url={message.media_url} 
                            type="video"
                            controls={(isOwn || downloadedIds.has(message.id))}
                            className={`max-w-full max-h-[350px] w-auto h-auto rounded-lg transition-all duration-500 ${
                              (!isOwn && !downloadedIds.has(message.id)) ? 'blur-[30px] scale-110 grayscale' : 
                              (isOwn && message.status === 'sending') ? 'blur-[8px]' : ''
                            }`} 
                          />

                          {isOwn && message.status === 'sending' && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20 z-10">
                              <div className="bg-black/60 p-3 rounded-full backdrop-blur-sm">
                                <Loader2 className="w-8 h-8 text-white animate-spin" />
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
                      {message.media_type === 'audio' && (
                        <div className="py-1 px-1 min-w-[200px] relative">
                          {message.status === 'sending' && (
                            <div className="absolute inset-0 bg-white/[0.02] backdrop-blur-[1px] flex items-center justify-center z-10 rounded-lg">
                               <Loader2 className="w-6 h-6 text-white animate-spin" />
                            </div>
                          )}
                          <CustomAudioPlayer 
                            src={message.media_url} 
                            isOwn={isOwn} 
                            avatarUrl={isOwn ? currentUserAvatar : otherUserAvatar} 
                          />
                        </div>
                      )}
                    </div>
                  )}

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

                    <div className={`flex items-center gap-1.5 absolute bottom-0 right-0 ${message.media_url && !message.content ? 'bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded-full ring-1 ring-white/10' : ''}`}>
                      <span className="text-[10px] text-white/40 tabular-nums lowercase select-none whitespace-nowrap">
                        {format(new Date(message.created_at), 'h:mm a')}
                      </span>
                      {isOwn && (
                        <div className="flex items-center">
                          {message.status === 'sending' ? (
                            <Clock className="w-3 h-3 text-white/30 animate-pulse" />
                          ) : message.status === 'sent' ? (
                            <Check className="w-3.5 h-3.5 text-white/30" />
                          ) : message.status === 'delivered' ? (
                            <CheckCheck className="w-4 h-4 text-white/30" />
                          ) : (
                            <CheckCheck className="w-4 h-4 text-[#34B7F1]" />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  
                </div>
                </motion.div>
              )}
            </motion.div>
          )
        })
      )}

      {/* Message Action Menu */}
      {menuAnchor && typeof document !== 'undefined' && createPortal(
        <>
          <div className="fixed inset-0 z-[1000]" onClick={() => setMenuAnchor(null)} />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="fixed z-[1001] bg-[#111] border border-white/10 rounded-xl shadow-2xl py-1.5 min-w-[170px] backdrop-blur-md"
            style={{ 
              top: Math.min(menuAnchor.y, typeof window !== 'undefined' ? window.innerHeight - 250 : menuAnchor.y), 
              left: Math.min(menuAnchor.x, typeof window !== 'undefined' ? window.innerWidth - 180 : menuAnchor.x) 
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

      {/* Fullscreen Lightbox */}
      {fullscreenImage && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center cursor-zoom-out p-4 backdrop-blur-sm"
          onClick={() => setFullscreenImage(null)}
        >
           <button 
             className="absolute top-6 right-6 p-3 text-white/60 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-all"
             onClick={() => setFullscreenImage(null)}
           >
             <X className="w-6 h-6" />
           </button>
           <img 
             src={fullscreenImage} 
             alt="Fullscreen media" 
             className="max-w-[95vw] max-h-[95vh] object-contain select-none rounded-sm"
             onClick={(e) => e.stopPropagation()}
           />
        </div>,
        document.body
      )}
    </div>
  )
}
