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
  onSendMessage: (content: string, mediaUrl?: string, mediaType?: string, replyTo?: string) => Promise<void>
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
  
  // Recording states
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)

  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Cleanup on unmount
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

    setIsUploading(true)
    const { publicUrl, mediaType, error } = await onFileUpload(file)
    if (!error && publicUrl) {
      await onSendMessage('', publicUrl, mediaType, replyingTo?.id)
      onCancelReply?.()
    }
    setIsUploading(false)
    setShowEmojiPicker(false)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setContent(e.target.value)

    if (!isTyping) {
      setIsTyping(true)
      onTyping(true)
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

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
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
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
          
          setIsUploading(true)
          onFileUpload(audioFile).then(({ publicUrl, error }) => {
            if (publicUrl && !error) {
              onSendMessage('', publicUrl, 'audio', replyingTo?.id)
              onCancelReply?.()
            }
            setIsUploading(false)
          })
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
    <div className="bg-[#202c33] border-t border-[#222e35] relative">
      {/* Emoji Picker Popup */}
      {showEmojiPicker && (
        <div className="absolute bottom-[calc(100%+12px)] left-2 sm:left-4 z-[999] shadow-[0_0_20px_rgba(0,0,0,0.5)] rounded-lg overflow-hidden border border-[#222e35] origin-bottom-left animate-in zoom-in-95 duration-150">
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
          <div className="flex-1 bg-[#1a2930] rounded-lg px-3 py-2 border-l-4 border-[#00a884]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <Reply className="w-3.5 h-3.5 text-[#00a884] shrink-0" />
                <span className="text-[#00a884] text-xs font-bold">{replyingTo.senderName}</span>
              </div>
              <button onClick={onCancelReply} className="p-1 hover:bg-[#374248] rounded-full text-[#8696a0] shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[#e9edef]/60 text-[12px] truncate mt-0.5">{replyingTo.content || '📎 Media'}</p>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="min-h-[62px] flex items-center px-4 py-2 gap-2">
        {isRecording ? (
          <div className="flex-1 flex items-center justify-between bg-[#2a3942] rounded-full py-2 px-4 animate-in fade-in slide-in-from-right-8">
            <div className="flex items-center gap-3 text-[#f15c6d]">
              <div className="w-2.5 h-2.5 rounded-full bg-[#f15c6d] animate-pulse"></div>
              <span className="tabular-nums font-medium">{formatTime(recordingTime)}</span>
            </div>
            <button onClick={() => stopRecording(true)} className="p-1.5 text-[#8696a0] hover:text-[#f15c6d] hover:bg-[#111b21] rounded-full transition-all">
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <>
            <div className="flex gap-2 text-[#8696a0] shrink-0">
              <button 
                onClick={() => setShowEmojiPicker(!showEmojiPicker)} 
                className={`p-2 hover:bg-[#374248] rounded-full transition-colors ${showEmojiPicker ? 'bg-[#374248] text-[#00a884]' : ''}`}
              >
                <Smile className="w-6 h-6" />
              </button>
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className={`p-2 hover:bg-[#374248] rounded-full transition-colors ${isUploading ? 'animate-pulse' : ''}`}
              >
                <Plus className="w-6 h-6 hover:rotate-90 transition-transform" />
              </button>
              <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} accept="image/*,video/*,application/pdf" />
            </div>

            <div className="flex-1 min-w-0">
              <input
                ref={inputRef}
                type="text"
                placeholder={isUploading ? "Uploading media..." : "Type a message"}
                disabled={isUploading}
                className="w-full bg-[#2a3942] text-[#e9edef] rounded-lg py-2.5 px-4 focus:ring-0 border-none placeholder-[#8696a0] text-[15px] disabled:opacity-50"
                value={content}
                onChange={handleChange}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSend() }}
                onClick={() => setShowEmojiPicker(false)}
              />
            </div>
          </>
        )}

        <div className="flex items-center text-[#8696a0] shrink-0 ml-1">
          {content.trim() ? (
            <button onClick={handleSend} className="p-3 bg-[#00a884] hover:bg-[#008f6f] text-[#111b21] rounded-full transition-all transform hover:scale-105 active:scale-95 shadow-lg">
              <Send className="w-5 h-5" />
            </button>
          ) : isRecording ? (
            <button onClick={() => stopRecording(false)} className="p-3 bg-[#25d366] hover:bg-[#1ebb5a] text-[#111b21] rounded-full transition-all transform hover:scale-105 active:scale-95 shadow-lg">
              <Send className="w-5 h-5 pl-0.5" />
            </button>
          ) : (
            <button onClick={startRecording} className="p-3 bg-[#00a884]/10 hover:bg-[#00a884]/20 text-[#00a884] rounded-full transition-colors">
              <Mic className="w-6 h-6" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
