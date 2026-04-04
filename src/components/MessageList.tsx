'use client'

import { format } from 'date-fns'
import { Check, CheckCheck, FileText, PlayCircle, Reply, Forward, ChevronDown, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'

import CustomAudioPlayer from './CustomAudioPlayer'
import { useSettings } from '@/hooks/useSettings'

interface Message {
  id: string
  content: string
  sender_id: string
  created_at: string
  status: 'sent' | 'delivered' | 'seen'
  media_url?: string
  media_type?: string
  reply_to?: string
  reply?: { id: string; content: string; sender_id: string } | null
  forwarded?: boolean
}

interface MessageListProps {
  messages: Message[]
  currentUserId: string
  otherUserAvatar?: string
  currentUserAvatar?: string
  onReply: (message: Message) => void
  onForward: (message: Message) => void
}

export default function MessageList({ messages, currentUserId, otherUserAvatar, currentUserAvatar, onReply, onForward }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null)
  
  const { settings, isLoaded } = useSettings()

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const getSenderName = (senderId: string) => {
    return senderId === currentUserId ? 'You' : 'Them'
  }

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-1.5 custom-scrollbar bg-transparent">
      {messages.length === 0 ? (
        <div className="flex items-center justify-center h-full text-[#8696a0] text-sm italic">
          Start a conversation...
        </div>
      ) : (
        messages.map((message) => {
          const isOwn = message.sender_id === currentUserId
          const isHovered = hoveredId === message.id
          return (
            <div
              key={message.id}
              className={`flex ${isOwn ? 'justify-end' : 'justify-start'} group`}
              onMouseEnter={() => setHoveredId(message.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <div className="relative max-w-[65%] min-w-[120px]">
                {/* Hover Action Menu */}
                <div className={`absolute ${isOwn ? 'left-0 -translate-x-full' : 'right-0 translate-x-full'} top-1 flex items-center gap-0.5 px-1 transition-all duration-200 z-10 ${isHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                  <button 
                    onClick={() => onReply(message)} 
                    className="p-1.5 rounded-full bg-[#202c33] hover:bg-[#374248] text-[#8696a0] hover:text-[#e9edef] transition-colors shadow-lg"
                    title="Reply"
                  >
                    <Reply className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => onForward(message)} 
                    className="p-1.5 rounded-full bg-[#202c33] hover:bg-[#374248] text-[#8696a0] hover:text-[#e9edef] transition-colors shadow-lg"
                    title="Forward"
                  >
                    <Forward className="w-4 h-4" />
                  </button>
                </div>

                {/* Message Bubble */}
                <div
                  className={`p-1.5 rounded-xl shadow-sm relative ${
                    isOwn ? 'text-[#e9edef] rounded-tr-none' : 'text-[#e9edef] rounded-tl-none'
                  }`}
                  style={{ backgroundColor: isLoaded ? (isOwn ? settings.sentBubbleColor : settings.receivedBubbleColor) : (isOwn ? '#005c4b' : '#202c33') }}
                >
                  {/* Forwarded Label */}
                  {message.forwarded && (
                    <div className="flex items-center gap-1 px-1 pb-0.5">
                      <Forward className="w-3 h-3 text-[#e9edef]/40" />
                      <span className="text-[11px] text-[#e9edef]/40 italic">Forwarded</span>
                    </div>
                  )}

                  {/* Reply Preview */}
                  {message.reply && (
                    <div className={`mx-1 mb-1 px-2.5 py-1.5 rounded-lg border-l-4 ${isOwn ? 'bg-[#025144] border-[#06cf9c]' : 'bg-[#1a2930] border-[#00a884]'}`}>
                      <p className="text-[#06cf9c] text-[11px] font-bold mb-0.5">
                        {message.reply.sender_id === currentUserId ? 'You' : 'Them'}
                      </p>
                      <p className="text-[#e9edef]/70 text-[12px] truncate leading-tight">
                        {message.reply.content || '📎 Media'}
                      </p>
                    </div>
                  )}

                  {/* Media Rendering */}
                  {message.media_url && (
                    <div className="mb-1">
                      {message.media_type === 'image' && (
                        <div className="relative rounded-lg overflow-hidden flex items-center justify-center bg-black/10">
                          <img 
                            src={message.media_url} 
                            alt="Shared media" 
                            onClick={() => setFullscreenImage(message.media_url as string)}
                            className="max-w-full max-h-[350px] w-auto h-auto object-contain rounded-lg cursor-pointer hover:opacity-95 transition-opacity" 
                          />
                        </div>
                      )}
                      {message.media_type === 'video' && (
                        <div className="relative rounded-lg overflow-hidden flex items-center justify-center bg-black/10">
                          <video 
                            src={message.media_url} 
                            controls 
                            className="max-w-full max-h-[350px] w-auto h-auto rounded-lg" 
                          />
                        </div>
                      )}
                      {message.media_type === 'audio' && (
                        <div className="py-1 px-1 min-w-[200px]">
                          <CustomAudioPlayer 
                            src={message.media_url} 
                            isOwn={isOwn} 
                            avatarUrl={isOwn ? currentUserAvatar : otherUserAvatar} 
                          />
                        </div>
                      )}
                      {(!message.media_type || message.media_type === 'application') && (
                        <div className="flex items-center gap-3 p-3 bg-[#111b21]/50 rounded-lg">
                          <FileText className="w-8 h-8 text-[#00a884]" />
                          <span className="text-sm font-medium truncate flex-1">Document File</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Content */}
                  {message.content && (
                    <p className={`px-1 leading-relaxed whitespace-pre-wrap break-words pb-4 ${
                      !isLoaded || settings.textSize === 'medium' ? 'text-[14.5px]' : settings.textSize === 'small' ? 'text-[13px]' : 'text-[16px]'
                    }`}>
                      {message.content}
                    </p>
                  )}

                  {/* Footer: Time + Ticks */}
                  <div className={`absolute bottom-1 right-2 flex items-center gap-1 ${message.media_url && !message.content ? 'bg-black/30 backdrop-blur-sm px-2 py-0.5 rounded-full' : ''}`}>
                    <span className="text-[10px] text-[#e9edef]/50 tabular-nums lowercase">
                      {format(new Date(message.created_at), 'h:mm a')}
                    </span>
                    {isOwn && (
                      <div className="flex items-center">
                        {message.status === 'sent' ? (
                          <Check className="w-3.5 h-3.5 text-[#e9edef]/50" />
                        ) : message.status === 'delivered' ? (
                          <CheckCheck className="w-4 h-4 text-[#e9edef]/50" />
                        ) : (
                          <CheckCheck className="w-4 h-4 text-[#53bdeb]" />
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* Message Tail */}
                  {!message.media_url && (
                    <div 
                      className={`absolute top-0 w-2 h-2 ${
                        isOwn ? '-right-2 bg-[#005c4b] [clip-path:polygon(0_0,0_100%,100%_0)]' : '-left-2 bg-[#202c33] [clip-path:polygon(100%_0,100%_100%,0_0)]'
                      }`}
                    />
                  )}
                </div>
              </div>
            </div>
          )
        })
      )}

      {/* Fullscreen Image Lightbox */}
      {fullscreenImage && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center cursor-zoom-out p-4 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setFullscreenImage(null)}
        >
           <button 
             className="absolute top-6 right-6 p-3 text-white/70 hover:text-white bg-black/50 hover:bg-black rounded-full transition-all shadow-lg"
             onClick={() => setFullscreenImage(null)}
           >
             <X className="w-6 h-6" />
           </button>
           <img 
             src={fullscreenImage} 
             alt="Fullscreen media" 
             className="max-w-[95vw] max-h-[95vh] object-contain select-none shadow-2xl rounded-sm animate-in zoom-in-95 duration-200"
             onClick={(e) => e.stopPropagation()}
           />
        </div>,
        document.body
      )}
    </div>
  )
}
