'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Image as ImageIcon, Video, Send, Rocket, Briefcase, GraduationCap, Lightbulb, Loader2, Play, Trash2, Plus, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { useAuth } from '@/context/AuthContext'
import { usePosts } from '@/hooks/usePosts'
import Image from 'next/image'

interface CreatePostModalProps {
  onClose: () => void
}

export default function CreatePostModal({ onClose }: CreatePostModalProps) {
  const { user } = useAuth()
  const { createPost } = usePosts()
  const [content, setContent] = useState('')
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('project')
  
  // Carousel states
  const [mediaFiles, setMediaFiles] = useState<File[]>([])
  const [previewUrls, setPreviewUrls] = useState<string[]>([])
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([])
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({})
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({})
  
  const [isFinalizing, setIsFinalizing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  // Cleanup preview URLs
  useEffect(() => {
    return () => {
      previewUrls.forEach(url => URL.revokeObjectURL(url))
    }
  }, [previewUrls])

  // Image Compression Utility
  const compressImage = (file: File): Promise<File> => {
    return new Promise((resolve) => {
      if (!file.type.startsWith('image/')) return resolve(file)
      
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = (event) => {
        const img = new (window as any).Image()
        img.src = event.target?.result
        img.onload = () => {
          const canvas = document.createElement('canvas')
          const MAX_WIDTH = 1200
          const MAX_HEIGHT = 1200
          let width = img.width
          let height = img.height

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width
              width = MAX_WIDTH
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height
              height = MAX_HEIGHT
            }
          }

          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          ctx?.drawImage(img, 0, 0, width, height)
          
          canvas.toBlob((blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              })
              resolve(compressedFile)
            } else {
              resolve(file)
            }
          }, 'image/jpeg', 0.8) // 80% quality is perfect for web
        }
      }
    })
  }

  const uploadFile = async (file: File, index: number) => {
    const fileId = `${file.name}-${index}`
    setUploadProgress(prev => ({ ...prev, [fileId]: 10 }))
    
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${user?.id}/${Date.now()}-${index}.${fileExt}`
      const filePath = `posts/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(filePath)

      setUploadedUrls(prev => {
        const next = [...prev]
        next[index] = publicUrl
        return next
      })
      setUploadProgress(prev => ({ ...prev, [fileId]: 100 }))
    } catch (err: any) {
      console.error(`Upload failed for file ${index}:`, err)
      setUploadErrors(prev => ({ ...prev, [fileId]: 'Failed' }))
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    // Standard Instagram limit: 10
    const remainingSlots = 10 - mediaFiles.length
    const incomingFiles = files.slice(0, remainingSlots)

    if (files.length > remainingSlots) {
       alert(`You can only add up to 10 items. Adding the first ${remainingSlots} selected.`)
    }

    const newPreviews = incomingFiles.map(file => URL.createObjectURL(file))
    const startIndex = mediaFiles.length
    
    setPreviewUrls(prev => [...prev, ...newPreviews])
    setMediaFiles(prev => [...prev, ...incomingFiles])
    
    // Process each file
    incomingFiles.forEach(async (file, i) => {
      const currentIndex = startIndex + i
      let fileToUpload = file
      if (file.type.startsWith('image/')) {
        fileToUpload = await compressImage(file)
      }
      uploadFile(fileToUpload, currentIndex)
    })
  }

  const removeMedia = (index: number) => {
    const file = mediaFiles[index]
    const fileId = `${file.name}-${index}`
    
    setMediaFiles(prev => prev.filter((_, i) => i !== index))
    setPreviewUrls(prev => {
      URL.revokeObjectURL(prev[index])
      return prev.filter((_, i) => i !== index)
    })
    setUploadedUrls(prev => prev.filter((_, i) => i !== index))
    
    // Clean up progress/errors
    const newProgress = { ...uploadProgress }
    delete newProgress[fileId]
    setUploadProgress(newProgress)
    
    const newErrors = { ...uploadErrors }
    delete newErrors[fileId]
    setUploadErrors(newErrors)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim() || isFinalizing) return

    // Ensure all selected files are uploaded
    if (uploadedUrls.filter(url => !!url).length !== mediaFiles.length) {
       alert('Please wait for all media to finish syncing.')
       return
    }

    setIsFinalizing(true)
    try {
      const { error } = await createPost({
        title: title.trim(),
        content: content.trim(),
        category,
        media_urls: uploadedUrls.filter(url => !!url),
        media_types: mediaFiles.map(f => f.type.startsWith('video') ? 'video' : 'image')
      })

      if (error) throw error
      onClose()
    } catch (err) {
      console.error('Failed to create post:', err)
      alert('Failed to share achievement.')
    } finally {
      setIsFinalizing(false)
    }
  }

  const isCompany = user?.user_metadata?.role === 'company' || user?.user_metadata?.role === 'professional'

  return (
    <div className="fixed inset-0 z-[300] bg-[#111b21]/95 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-[#202c33] w-full max-w-xl rounded-[32px] overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] relative border border-white/5 animate-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div className="px-8 py-5 flex items-center justify-between bg-gradient-to-r from-[#202c33] to-[#2a3942]/50 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#00a884]/20 rounded-xl text-[#00a884]">
              <Rocket className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-[#e9edef] font-bold text-lg leading-none mb-1">Share Achievement</h2>
              <p className="text-[#8696a0] text-[9px] uppercase tracking-widest font-black">Inspire the tech community</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2.5 hover:bg-white/5 rounded-full transition-all text-[#8696a0] hover:text-[#e9edef] active:scale-90">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-0 flex flex-col max-h-[85vh]">
          
          <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-8">
            
            {/* Post Title */}
            <div className="space-y-2">
              <label className="text-[9px] font-black uppercase tracking-[0.2em] text-[#00a884] ml-1">Achievement Name</label>
              <input
                type="text"
                placeholder="e.g. My Next.js Dashboard v1.0"
                className="w-full bg-[#2a3942]/50 text-[#e9edef] text-base font-bold px-5 py-3.5 rounded-2xl border-2 border-transparent focus:border-[#00a884]/50 outline-none transition-all placeholder:text-[#8696a0]/30"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            {/* Carousel Upload Area */}
            <div className="space-y-2">
              <label className="text-[9px] font-black uppercase tracking-[0.2em] text-[#00a884] ml-1 flex justify-between items-center">
                Visual Proof ({mediaFiles.length}/10)
              </label>
              
              <div className="flex gap-3 overflow-x-auto pb-4 custom-scrollbar snap-x">
                {previewUrls.map((url, idx) => (
                  <div key={url} className="relative aspect-[4/5] h-64 rounded-[24px] shrink-0 overflow-hidden bg-black/40 border border-white/10 group snap-center">
                    {mediaFiles[idx]?.type.startsWith('video') ? (
                      <video src={url} className="w-full h-full object-cover" />
                    ) : (
                      <div className="relative w-full h-full">
                         <Image src={url} alt="Preview" fill className="object-cover" unoptimized />
                      </div>
                    )}
                    
                    {/* Status Icons */}
                    <div className="absolute top-2 right-2 flex flex-col gap-2">
                      <button 
                         type="button" 
                         onClick={() => removeMedia(idx)}
                         className="p-1.5 bg-black/60 hover:bg-red-500 text-white rounded-full backdrop-blur-md transition-all active:scale-90"
                      >
                         <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      
                      {uploadProgress[`${mediaFiles[idx].name}-${idx}`] === 100 ? (
                        <div className="p-1.5 bg-[#00a884] text-[#111b21] rounded-full scale-90">
                           <CheckCircle2 className="w-3.5 h-3.5" />
                        </div>
                      ) : uploadErrors[`${mediaFiles[idx].name}-${idx}`] ? (
                        <div className="p-1.5 bg-[#ef4444] text-white rounded-full scale-90">
                           <X className="w-3.5 h-3.5" />
                        </div>
                      ) : (
                        <div className="p-1.5 bg-[#111b21]/80 text-[#00a884] rounded-full scale-90">
                           <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        </div>
                      )}
                    </div>

                    {/* Individual progress bar */}
                    {uploadProgress[`${mediaFiles[idx].name}-${idx}`] < 100 && (
                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
                         <div 
                           className="h-full bg-[#00a884] transition-all duration-300"
                           style={{ width: `${uploadProgress[`${mediaFiles[idx].name}-${idx}`]}%` }}
                         />
                      </div>
                    )}
                  </div>
                ))}

                {mediaFiles.length < 10 && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="aspect-[4/5] h-64 rounded-[24px] border-2 border-dashed border-[#2a3942] hover:border-[#00a884]/50 bg-[#2a3942]/20 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all group shrink-0 snap-center"
                  >
                    <div className="p-4 bg-[#2a3942] rounded-2xl group-hover:bg-[#00a884]/20 transition-colors">
                      <Plus className="w-8 h-8 text-[#8696a0] group-hover:text-[#00a884]" />
                    </div>
                    <span className="text-[#8696a0] text-[10px] font-black uppercase tracking-wider">Add More</span>
                  </button>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple hidden onChange={handleFileChange} />
            </div>

            {/* Description */}
            <div className="space-y-2">
               <label className="text-[9px] font-black uppercase tracking-[0.2em] text-[#00a884] ml-1">The Story / Details</label>
               <textarea
                 required
                 placeholder="Share the journey..."
                 className="w-full bg-[#2a3942]/50 text-[#e9edef] text-sm px-6 py-4 rounded-2xl border-2 border-transparent focus:border-[#00a884]/50 outline-none transition-all resize-none h-40 placeholder:text-[#8696a0]/30 custom-scrollbar leading-relaxed"
                 value={content}
                 onChange={(e) => setContent(e.target.value)}
               />
            </div>

            {/* Category Grid */}
            <div className="space-y-3">
              <label className="text-[9px] font-black uppercase tracking-[0.2em] text-[#00a884] ml-1">Label this achievement</label>
              <div className="grid grid-cols-2 gap-3">
                 {[
                   { id: 'project', label: 'Tech Project', icon: Rocket },
                   { id: 'workshop', label: 'Workshop', icon: GraduationCap },
                   { id: 'tip', label: 'Tech Tip', icon: Lightbulb },
                   { id: 'hiring', label: 'Hiring', icon: Briefcase, disabled: !isCompany },
                 ].map((cat) => (
                   <button
                     key={cat.id}
                     type="button"
                     disabled={cat.disabled}
                     onClick={() => setCategory(cat.id)}
                     className={`flex items-center gap-3 px-4 py-4 rounded-2xl border-2 transition-all
                       ${cat.disabled ? 'opacity-20 cursor-not-allowed border-transparent grayscale' : 
                         category === cat.id ? `bg-[#00a884]/10 border-[#00a884] text-[#e9edef]` : 'bg-[#2a3942]/40 border-transparent text-[#8696a0]'}`}
                   >
                     <cat.icon className="w-4 h-4" />
                     <span className="text-sm font-bold">{cat.label}</span>
                   </button>
                 ))}
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="px-8 py-5 bg-[#111b21]/50 border-t border-white/5 flex items-center justify-end">
            <button
              type="submit"
              disabled={!content.trim() || isFinalizing || (mediaFiles.length > 0 && uploadedUrls.filter(u => !!u).length !== mediaFiles.length)}
              className="group relative flex items-center gap-2.5 bg-[#00a884] disabled:opacity-50 hover:bg-[#00c99e] text-[#111b21] px-8 py-3 rounded-full font-black text-xs uppercase tracking-widest transition-all shadow-lg active:scale-95"
            >
              {isFinalizing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              {isFinalizing ? 'Launching...' : 'Release Post'}
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}
