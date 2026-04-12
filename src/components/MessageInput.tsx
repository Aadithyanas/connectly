'use client'

import { useState, useRef, useEffect } from 'react'
import { Smile, Plus, Send, Mic, X, Reply, Trash2, StopCircle } from 'lucide-react'
import EmojiPicker, { Theme } from 'emoji-picker-react'

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
  
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)

  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current)
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        const tracks = mediaRecorderRef.current.stream.getTracks()
        tracks.forEach(track => track.stop())
        mediaRecorderRef.current.stop()
      }
    }
  }, [])

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
    const file = e.target.files?.[0]
    if (!file) return
    onSendMessage('', undefined, undefined, replyingTo?.id, file)
    onCancelReply?.()
    setShowEmojiPicker(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
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
      setShowEmojiPicker(false)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
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
    } catch (err) {
      console.error("Error accessing microphone:", err)
      alert("Microphone permission denied or not available.")
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
          <div className="flex-1 flex items-center justify-between bg-white/[0.04] rounded-full py-2 px-4">
            <div className="flex items-center gap-3 text-red-400">
              <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse"></div>
              <span className="tabular-nums font-medium text-sm">{formatTime(recordingTime)}</span>
            </div>
            <button onClick={() => stopRecording(true)} className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-white/[0.04] rounded-full transition-all">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <>
            <div className="flex gap-1 text-[#adaaaa] shrink-0">
              <button 
                onClick={() => setShowEmojiPicker(!showEmojiPicker)} 
                className={`p-2 hover:bg-white/[0.06] rounded-full transition-colors ${showEmojiPicker ? 'bg-white/[0.06] text-[#bc9dff]' : ''}`}
              >
                <Smile className="w-5 h-5" />
              </button>
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className={`p-2 hover:bg-white/[0.06] rounded-full transition-colors ${isUploading ? 'animate-pulse' : ''}`}
              >
                <Plus className="w-5 h-5 hover:rotate-90 transition-transform" />
              </button>
              <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} accept="image/*,video/*,application/pdf" />
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
                onClick={() => setShowEmojiPicker(false)}
              />
            </div>
            </>
          )}
        </div>

        <div className="flex items-center text-[#adaaaa] shrink-0">
          {content.trim() ? (
            <button onClick={handleSend} className="p-2.5 primary-gradient text-white rounded-full transition-all active:scale-95 primary-shadow ml-1">
              <Send className="w-4 h-4" />
            </button>
          ) : isRecording ? (
            <button onClick={() => stopRecording(false)} className="p-2.5 primary-gradient text-white rounded-full transition-all active:scale-95 primary-shadow ml-1">
              <Send className="w-4 h-4 pl-0.5" />
            </button>
          ) : (
            <button onClick={startRecording} className="p-2 hover:bg-white/[0.06] text-[#adaaaa] hover:text-[#bc9dff] rounded-full transition-colors ml-1">
              <Mic className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
