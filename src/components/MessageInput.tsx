'use client'

import { useState, useRef, useEffect } from 'react'
import { Smile, Plus, Send, Mic, X, Reply, Trash2, StopCircle, Image as ImageIcon, FileText, AlertCircle } from 'lucide-react'
import EmojiPicker, { Theme } from 'emoji-picker-react'
import { motion, AnimatePresence } from 'framer-motion'

interface ReplyingTo {
  id: string
  content: string
  sender_id: string
  senderName: string
}

interface MessageInputProps {
  onSendMessage: (content: string, mediaUrl?: string, mediaType?: string, replyTo?: string, mediaFile?: File) => Promise<any>
  onTyping: (isTyping: boolean) => void
  onFileUpload: (file: File) => Promise<{ publicUrl?: string, mediaType?: string, error?: any }>
  replyingTo?: ReplyingTo | null
  onCancelReply?: () => void
}

export default function MessageInput({ onSendMessage, onTyping, onFileUpload, replyingTo, onCancelReply }: MessageInputProps) {
  const [content, setContent] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false)
  
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [micPermission, setMicPermission] = useState<'granted' | 'denied' | 'prompt'>('prompt')
  const [micError, setMicError] = useState<string | null>(null)

  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const docInputRef = useRef<HTMLInputElement>(null)
  const mediaInputRef = useRef<HTMLInputElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowAttachmentMenu(false)
      }
    }
    if (showAttachmentMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current)
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        const tracks = mediaRecorderRef.current.stream.getTracks()
        tracks.forEach(track => track.stop())
        mediaRecorderRef.current.stop()
      }
    }
  }, [showAttachmentMenu])

  const handleSend = async () => {
    if (!content.trim() && !isUploading) return
    const text = content
    setContent('')
    setShowEmojiPicker(false)
    onTyping(false)
    await onSendMessage(text, undefined, undefined, replyingTo?.id)
    onCancelReply?.()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    
    // Send each file individually
    for (let i = 0; i < files.length; i++) {
      onSendMessage('', undefined, undefined, replyingTo?.id, files[i])
    }
    
    onCancelReply?.()
    setShowAttachmentMenu(false)
    setShowEmojiPicker(false)
    
    // Clear all file inputs
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (docInputRef.current) docInputRef.current.value = ''
    if (mediaInputRef.current) mediaInputRef.current.value = ''
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setContent(e.target.value)
    if (!isTyping) {
      setIsTyping(true)
      onTyping(true)
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false)
      onTyping(false)
    }, 3000)
  }

  const onEmojiClick = (emojiObject: any) => {
    setContent((prev) => prev + emojiObject.emoji)
  }

  const startRecording = async () => {
    try {
      // 1. Check for Hardware first
      const devices = await navigator.mediaDevices.enumerateDevices().catch(() => [])
      const hasMic = devices.some(d => d.kind === 'audioinput')
      
      console.log("[Mic-Check] Hardware detected:", hasMic, "Insecure Context:", !window.isSecureContext)

      if (!hasMic) {
        setMicError("No microphone found. Please check your hardware connection.")
        return
      }

      // 2. Check for Secure Context
      if (typeof window !== 'undefined' && !window.isSecureContext && window.location.hostname !== 'localhost') {
        setMicError("Blocked: Browser requires HTTPS for microphone access.")
        return
      }

      // 3. Check if API is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setMicError("Your browser is blocking microphone access for this site.")
        return
      }

      // 4. Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      setMicPermission('granted')
      setMicError(null)
      
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data)
      }
      
      mediaRecorder.start()
      setIsRecording(true)
      setRecordingTime(0)
      audioChunksRef.current = []
      
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1)
      }, 1000)
    } catch (err: any) {
      console.error("Critical Mic Failure:", {
        name: err.name,
        message: err.message,
        isSecure: window.isSecureContext,
        origin: window.location.origin
      })

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setMicPermission('denied')
        setMicError("Permission denied. Reset it in browser settings (Lock icon).")
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setMicError("Microphone is used by another app (e.g., Zoom/Teams).")
      } else if (err.name === 'TypeError' && !window.isSecureContext) {
        setMicError("Security Error: Try using '127.0.0.1' instead of 'localhost'")
      } else {
        setMicError(`Unable to start: ${err.name || 'System block'}`)
      }

      setTimeout(() => setMicError(null), 8000)
    }
  }

  const stopRecording = (discard = false) => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.onstop = () => {
        const tracks = mediaRecorderRef.current?.stream.getTracks()
        tracks?.forEach(track => track.stop())
        
        if (!discard) {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
          const audioFile = new File([audioBlob], `voice-message-${Date.now()}.webm`, { type: 'audio/webm' })
          onSendMessage('', undefined, 'audio', replyingTo?.id, audioFile)
          onCancelReply?.()
        }
        audioChunksRef.current = []
      }
      mediaRecorderRef.current.stop()
    }
    
    setIsRecording(false)
    if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current)
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div className="relative pb-2 sm:pb-3 pb-[env(safe-area-inset-bottom,0.5rem)]" style={{background:'rgba(14,14,14,0.9)'}}>
      {/* Emoji Picker */}
      {showEmojiPicker && (
        <div className="absolute bottom-[calc(100%+8px)] left-2 sm:left-4 z-[999] shadow-2xl rounded-xl overflow-hidden border border-white/[0.06] origin-bottom-left">
          <EmojiPicker 
            onEmojiClick={onEmojiClick} 
            theme={Theme.DARK} 
            autoFocusSearch={false}
            height={400}
            width={320}
            lazyLoadEmojis={true}
            searchDisabled={false}
            previewConfig={{ showPreview: false }}
          />
        </div>
      )}

      {/* Reply Bar */}
      {replyingTo && !isRecording && (
        <div className="flex items-center gap-2 px-4 pt-2 pb-1">
          <div className="flex-1 bg-white/[0.03] rounded-lg px-3 py-2 border-l-2 border-zinc-500">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <Reply className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                <span className="text-zinc-400 text-xs font-bold">{replyingTo.senderName}</span>
              </div>
              <button onClick={onCancelReply} className="p-1 hover:bg-white/[0.06] rounded-full text-zinc-600 shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-zinc-600 text-[12px] truncate mt-0.5">{replyingTo.content || '📎 Media'}</p>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="min-h-[52px] flex items-end px-3 sm:px-4 py-2 gap-2">
        <div className="flex-1 glass-dock rounded-[1.5rem] flex items-center gap-1 px-2 py-1.5">
        {isRecording ? (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex-1 flex items-center justify-between bg-white/[0.04] backdrop-blur-md rounded-full py-2 px-4 border border-white/[0.05]"
          >
            <div className="flex items-center gap-3">
              <div className="relative flex items-center justify-center">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping absolute opacity-70"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-red-500 relative"></div>
              </div>
              <span className="tabular-nums font-bold text-zinc-300 tracking-tight">{formatTime(recordingTime)}</span>
              
              <div className="flex gap-1 ml-4 h-4 items-center">
                {[...Array(6)].map((_, i) => (
                  <motion.div
                    key={i}
                    animate={{ height: [8, 16, 8] }}
                    transition={{ 
                      repeat: Infinity, 
                      duration: 0.6, 
                      delay: i * 0.1,
                      ease: "easeInOut"
                    }}
                    className="w-0.5 bg-red-400/50 rounded-full"
                  />
                ))}
              </div>
            </div>
            
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-3"
            >
              <span className="text-[10px] uppercase tracking-[0.1em] text-zinc-600 font-bold hidden sm:block">Recording...</span>
              <button 
                onClick={() => stopRecording(true)} 
                className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-full transition-all group"
              >
                <Trash2 className="w-4 h-4 group-active:scale-90 transition-transform" />
              </button>
            </motion.div>
          </motion.div>
        ) : (
          <>
            <div className="flex gap-1 text-[#adaaaa] shrink-0">
              <button 
                onClick={() => {
                  setShowEmojiPicker(!showEmojiPicker)
                  setShowAttachmentMenu(false)
                }} 
                className={`p-2 hover:bg-white/[0.06] rounded-full transition-colors ${showEmojiPicker ? 'bg-white/[0.06] text-[#bc9dff]' : ''}`}
              >
                <Smile className="w-5 h-5" />
              </button>
              
              <div className="relative">
                <button 
                  onClick={() => {
                    setShowAttachmentMenu(!showAttachmentMenu)
                    setShowEmojiPicker(false)
                  }}
                  disabled={isUploading}
                  className={`p-2 hover:bg-white/[0.06] rounded-full transition-all ${isUploading ? 'animate-pulse' : ''} ${showAttachmentMenu ? 'bg-white/[0.06] text-[#bc9dff] rotate-45' : ''}`}
                >
                  <Plus className="w-5 h-5 transition-transform" />
                </button>

                <AnimatePresence>
                  {showAttachmentMenu && (
                    <motion.div
                      ref={menuRef}
                      initial={{ opacity: 0, y: 10, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.9 }}
                      className="absolute bottom-full left-0 mb-3 bg-[#1a1a1a] border border-white/[0.06] rounded-2xl p-2 shadow-2xl z-[1000] min-w-[190px] backdrop-blur-xl"
                      style={{ boxShadow: '0 20px 50px rgba(0,0,0,0.5), 0 0 0 1px rgba(188,157,255,0.05)' }}
                    >
                      <button
                        onClick={() => {
                          mediaInputRef.current?.click()
                          setShowAttachmentMenu(false)
                        }}
                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.04] text-zinc-300 hover:text-white transition-all group"
                      >
                        <div className="p-2 rounded-lg bg-purple-500/10 text-[#bc9dff] group-hover:bg-purple-500/20">
                          <ImageIcon className="w-5 h-5" />
                        </div>
                        <span className="text-[13px] font-medium">Photos & Videos</span>
                      </button>
                      <button
                        onClick={() => {
                          docInputRef.current?.click()
                          setShowAttachmentMenu(false)
                        }}
                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.04] text-zinc-300 hover:text-white transition-all group"
                      >
                        <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20">
                          <FileText className="w-5 h-5" />
                        </div>
                        <span className="text-[13px] font-medium">Document</span>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <input type="file" ref={mediaInputRef} className="hidden" onChange={handleFileChange} accept="image/*,video/*" multiple />
              <input type="file" ref={docInputRef} className="hidden" onChange={handleFileChange} accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" multiple />
            </div>

            <div className="flex-1 min-w-0">
              <input
                ref={inputRef}
                type="text"
                placeholder={isUploading ? "Uploading media..." : "Type a message"}
                disabled={isUploading}
                className="w-full bg-transparent text-white py-2.5 px-2 focus:ring-0 border-none placeholder-[#767575] text-[14px] disabled:opacity-50 outline-none transition-all"
                value={content}
                onChange={handleChange}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSend() }}
                onClick={() => {
                  setShowEmojiPicker(false)
                  setShowAttachmentMenu(false)
                }}
              />
            </div>
            </>
          )}
        </div>

        <div className="flex items-center text-[#adaaaa] shrink-0 relative">
          {micError && (
            <div className="absolute bottom-full right-0 mb-2 whitespace-nowrap bg-black/90 border border-red-500/20 px-3 py-1.5 rounded-lg shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-300">
              <span className="text-[11px] text-red-400 font-medium flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5" />
                {micError}
              </span>
            </div>
          )}
          {content.trim() ? (
            <motion.button 
              layoutId="send-btn"
              onClick={handleSend} 
              className="p-3 primary-gradient text-white rounded-full transition-all active:scale-90 primary-shadow ml-1 overflow-hidden"
            >
              <Send className="w-4 h-4" />
            </motion.button>
          ) : isRecording ? (
            <motion.button 
              layoutId="send-btn"
              initial={{ scale: 0.8, rotate: -20 }}
              animate={{ scale: 1.1, rotate: 0 }}
              whileHover={{ scale: 1.2 }}
              onClick={() => stopRecording(false)} 
              className="p-3 bg-red-500 text-white rounded-full transition-all active:scale-90 shadow-[0_0_20px_rgba(239,68,68,0.3)] ml-1"
            >
              <StopCircle className="w-5 h-5" />
            </motion.button>
          ) : (
            <motion.button 
              layoutId="send-btn"
              onClick={startRecording} 
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className={`p-2.5 rounded-full transition-all ml-1 ${
                micError 
                  ? 'text-red-500/50 hover:bg-red-500/5' 
                  : 'hover:bg-white/[0.08] text-[#adaaaa] hover:text-[#bc9dff]'
              }`}
              title={micError ? "Microphone access blocked" : "Record Voice"}
            >
              {micError ? <AlertCircle className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </motion.button>
          )}
        </div>
      </div>
    </div>
  )
}
