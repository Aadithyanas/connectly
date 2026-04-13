'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Image as ImageIcon, Video, Send, Rocket, Briefcase, GraduationCap, Lightbulb, Loader2, Play, Trash2, Plus, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { useAuth } from '@/context/AuthContext'
import { usePosts, Post } from '@/hooks/usePosts'
import Image from 'next/image'

interface CreatePostModalProps {
  onClose: () => void
  quotedPost?: Post
}

export default function CreatePostModal({ onClose, quotedPost }: CreatePostModalProps) {
  const { user } = useAuth()
  const { createPost } = usePosts()
  const [content, setContent] = useState('')
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('general')

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

    // 1. Determine resource type and set limits
    const isVideo = file.type.startsWith('video/')
    const resourceType = isVideo ? 'video' : (file.type.startsWith('image/') ? 'image' : 'raw')

    // Limits: Video = 100MB, Others = 10MB
    const limit = (resourceType === 'video') ? 100 * 1024 * 1024 : 10 * 1024 * 1024
    if (file.size > limit) {
      setUploadErrors(prev => ({ ...prev, [fileId]: `Too large (>${limit / (1024 * 1024)}MB)` }))
      return
    }

    setUploadProgress(prev => ({ ...prev, [fileId]: 10 }))

    try {
      // 2. Get Signature via API
      const signRes = await fetch('/api/cloudinary/sign', {
        method: 'POST',
        body: JSON.stringify({
          folder: `posts/${user?.id || 'anonymous'}`
        })
      })
      const signData = await signRes.json()
      if (!signRes.ok) throw new Error(signData.error || 'Failed to get signature')

      setUploadProgress(prev => ({ ...prev, [fileId]: 30 }))

      // 3. Upload to Cloudinary using correct endpoint
      const formData = new FormData()
      formData.append('file', file)
      formData.append('api_key', signData.apiKey)
      formData.append('timestamp', signData.timestamp)
      formData.append('signature', signData.signature)
      formData.append('folder', `posts/${user?.id || 'anonymous'}`)
      // The upload URL endpoint (e.g. /video/upload) tells Cloudinary the type — don't append resource_type to FormData.

      const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${signData.cloudName}/${resourceType}/upload`, {
        method: 'POST',
        body: formData
      })
      const uploadData = await uploadRes.json()
      if (!uploadRes.ok) throw new Error(uploadData.error?.message || 'Upload failed')

      setUploadedUrls(prev => {
        const next = [...prev]
        next[index] = uploadData.secure_url
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
        media_types: mediaFiles.map(f => f.type.startsWith('video') ? 'video' : 'image'),
        quoted_post_id: quotedPost?.id
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
    <div className="fixed inset-0 z-[300] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-[#0a0a0a] w-full max-w-xl rounded-[32px] overflow-hidden shadow-2xl relative border border-white/[0.06] animate-in zoom-in-95 duration-300">

        {/* Header */}
        <div className="px-8 py-5 flex items-center justify-between bg-black/50 border-b border-white/[0.04]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/[0.06] rounded-xl text-white">
              <Rocket className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-white font-bold text-lg leading-none mb-1">Create Post</h2>
              <p className="text-zinc-500 text-[9px] uppercase tracking-widest font-black">Share with the community</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2.5 hover:bg-white/10 rounded-full transition-all text-zinc-500 hover:text-white active:scale-90">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-0 flex flex-col max-h-[85vh]">

          <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-8">

            {/* Post Title */}
            <div className="space-y-2">
              <label className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500 ml-1">Title (Optional)</label>
              <input
                type="text"
                placeholder="What's this about?"
                className="w-full bg-white/[0.03] text-white text-base font-bold px-5 py-3.5 rounded-2xl border border-white/[0.06] focus:border-white/20 outline-none transition-all placeholder:text-zinc-700"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            {/* Carousel Upload Area */}
            <div className="space-y-2">
              {mediaFiles.length > 0 && (
                <label className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500 ml-1 flex justify-between items-center">
                  Media ({mediaFiles.length}/10)
                </label>
              )}

              {mediaFiles.length > 0 && (
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
                          <div className="p-1.5 bg-white text-black rounded-full scale-90">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </div>
                        ) : uploadErrors[`${mediaFiles[idx].name}-${idx}`] ? (
                          <div className="p-1.5 bg-red-500 text-white rounded-full scale-90">
                            <X className="w-3.5 h-3.5" />
                          </div>
                        ) : (
                          <div className="p-1.5 bg-black/80 text-white rounded-full scale-90">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          </div>
                        )}
                      </div>

                      {/* Individual progress bar */}
                      {uploadProgress[`${mediaFiles[idx].name}-${idx}`] < 100 && (
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
                          <div
                            className="h-full bg-white transition-all duration-300"
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
                      className="aspect-[4/5] h-64 rounded-[24px] border-2 border-dashed border-white/10 hover:border-white/30 bg-white/[0.02] flex flex-col items-center justify-center gap-4 cursor-pointer transition-all group shrink-0 snap-center"
                    >
                      <div className="p-4 bg-white/[0.04] rounded-2xl group-hover:bg-white/[0.08] transition-colors">
                        <Plus className="w-8 h-8 text-zinc-500 group-hover:text-white" />
                      </div>
                      <span className="text-zinc-500 text-[10px] font-black uppercase tracking-wider">Add More</span>
                    </button>
                  )}
                </div>
              )}
              <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple hidden onChange={handleFileChange} />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <label className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500 ml-1">What's on your mind?</label>
              <textarea
                required
                placeholder="Share your thoughts, questions, or journey..."
                className="w-full bg-white/[0.03] text-white text-sm px-6 py-4 rounded-2xl border border-white/[0.06] focus:border-white/20 outline-none transition-all resize-none h-40 placeholder:text-zinc-700 custom-scrollbar leading-relaxed"
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />

              {quotedPost && (
                <div className="mt-4 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] shadow-inner relative overflow-hidden">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#bc9dff]/50"></div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-5 h-5 rounded-full overflow-hidden bg-white/10 shrink-0">
                      {quotedPost.user?.avatar_url ? (
                        <img src={quotedPost.user.avatar_url} alt="User" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[8px] font-bold text-white bg-[#bc9dff]/30 uppercase">
                          {quotedPost.user?.name?.[0] || '?'}
                        </div>
                      )}
                    </div>
                    <span className="text-white text-xs font-bold">{quotedPost.user?.name}</span>
                    <span className="text-zinc-500 text-[10px]">· {new Date(quotedPost.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className="text-zinc-400 text-xs leading-relaxed line-clamp-3">
                    {quotedPost.content || quotedPost.title || 'Attached Media'}
                  </p>
                </div>
              )}

              {/* Media Quick Add Toolbar */}
              {mediaFiles.length === 0 && (
                <div className="mt-3 flex items-center">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2 bg-white/[0.03] outline-none hover:bg-white/[0.06] border border-white/[0.06] rounded-xl transition-all text-zinc-400 hover:text-white"
                  >
                    <Plus className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-wider">Add Media</span>
                  </button>
                </div>
              )}
            </div>

          </div>

          {/* Footer Actions */}
          <div className="px-8 py-5 bg-black/50 border-t border-white/[0.04] flex items-center justify-end">
            <button
              type="submit"
              disabled={!content.trim() || isFinalizing || (mediaFiles.length > 0 && uploadedUrls.filter(u => !!u).length !== mediaFiles.length)}
              className="group relative flex items-center gap-2.5 bg-white disabled:opacity-50 hover:bg-zinc-200 text-black px-8 py-3 rounded-full font-black text-xs uppercase tracking-widest transition-all shadow-lg active:scale-95"
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
