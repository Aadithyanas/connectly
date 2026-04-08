'use client'

import { format } from 'date-fns'
import { Check, CheckCheck, FileText, PlayCircle, Reply, Forward, ChevronDown, X, Clock, Loader2, Download } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'

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
}

interface MessageListProps {
  messages: Message[]
  loading?: boolean
  currentUserId: string
  otherUserAvatar?: string
  currentUserAvatar?: string
  onReply: (message: Message) => void
  onForward: (message: Message) => void
}

export default function MessageList({ messages, loading, currentUserId, otherUserAvatar, currentUserAvatar, onReply, onForward }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null)
  const [downloadedIds, setDownloadedIds] = useState<Set<string>>(new Set())
  
  const { settings, isLoaded } = useSettings()

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

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
    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-1.5 custom-scrollbar bg-transparent">
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
          return (
            <div
              key={message.client_id || message.id}
              className={`flex w-full mb-1 ${isOwn ? 'justify-end' : 'justify-start'} group items-start`}
              onMouseEnter={() => setHoveredId(message.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <div className={`relative max-w-[85%] sm:max-w-[75%] flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                {/* Hover Actions */}
                <div className={`absolute ${isOwn ? 'left-0 -translate-x-full' : 'right-0 translate-x-full'} top-1 flex items-center gap-0.5 px-1 transition-all duration-150 z-10 ${isHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                  <button 
                    onClick={() => onReply(message)} 
                    className="p-1.5 rounded-full bg-[#111] hover:bg-white/[0.08] text-zinc-600 hover:text-white transition-colors"
                    title="Reply"
                  >
                    <Reply className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onClick={() => onForward(message)} 
                    className="p-1.5 rounded-full bg-[#111] hover:bg-white/[0.08] text-zinc-600 hover:text-white transition-colors"
                    title="Forward"
                  >
                    <Forward className="w-3.5 h-3.5" />
                  </button>
                </div>
 
                {/* Bubble */}
                <div
                   className={`p-2.5 rounded-2xl relative w-fit min-w-[85px] will-change-transform border ${
                     isOwn ? 'bg-[#1a1a1a] text-white border-white/[0.06] rounded-br-[4px]' : 'bg-white/[0.04] text-white border-white/[0.04] rounded-bl-[4px]'
                   }`}
                  style={{ 
                    backgroundColor: (message.media_url && !message.content) ? 'transparent' : undefined,
                    backdropFilter: (message.media_url && message.content) ? 'blur(4px)' : 'none'
                  }}
                >
                  {/* Forwarded */}
                  {message.forwarded && (
                    <div className="flex items-center gap-1 px-1 pb-0.5">
                      <Forward className="w-3 h-3 text-white/30" />
                      <span className="text-[11px] text-white/30 italic">Forwarded</span>
                    </div>
                  )}

                  {/* Reply Preview */}
                  {message.reply && (
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
                  {message.media_url && (
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
                      {(!message.media_type || message.media_type === 'application') && (
                        <div className="flex items-center gap-3 p-3 bg-white/[0.03] rounded-lg">
                          <FileText className="w-8 h-8 text-zinc-500" />
                          <span className="text-sm font-medium truncate flex-1">Document File</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Content & Footer */}
                  <div className="flex flex-col relative">
                    {message.content && (
                      <p className={`px-1 leading-relaxed whitespace-pre-wrap break-words pb-4 ${
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
                            <CheckCheck className="w-4 h-4 text-white" />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  
                </div>
              </div>
            </div>
          )
        })
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
