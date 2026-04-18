'use client'

import { useState } from 'react'
import { Plus, Settings, Camera, X, Play, Image as ImageIcon, Send, Loader2, ChevronLeft } from 'lucide-react'
import Image from 'next/image'
import { useStatuses, Status } from '@/hooks/useStatuses'
import { useSettings } from '@/hooks/useSettings'
import StatusPrivacyModal from './StatusPrivacyModal'

interface StatusTabProps {
  onStatusClick: (statuses: Status[]) => void
  onBack?: () => void
}

export default function StatusTab({ onStatusClick, onBack }: StatusTabProps) {
  const { myStatuses, partnerStatuses, loading, uploadStatus, refresh } = useStatuses()
  const { settings } = useSettings()
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [caption, setCaption] = useState('')

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) setSelectedFile(e.target.files[0])
  }

  const handleUpload = async () => {
    if (!selectedFile) return
    setIsUploading(true)
    const res = await uploadStatus(selectedFile, caption)
    setIsUploading(false)
    if (res?.success) {
      setSelectedFile(null)
      setCaption('')
      if (refresh) refresh()
      alert('Initiative uploaded! 🚀')
    }
  }

  return (
    <div className="flex flex-col h-full bg-black w-full min-w-0 overflow-hidden relative">
      <div className="w-full h-[56px] flex items-center justify-between px-4 bg-[#0a0a0a] text-white shrink-0 border-b border-white/[0.04]">
        <div className="flex items-center gap-4">
          {onBack && (
            <button onClick={onBack} className="md:hidden p-1 hover:bg-white/[0.06] rounded-full transition-colors">
              <ChevronLeft className="w-5 h-5 text-zinc-500" />
            </button>
          )}
          <h2 className="text-base font-bold">Initiative</h2>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setIsPrivacyOpen(true)} className="p-2 hover:bg-white/[0.06] rounded-full transition-colors text-zinc-500" title="Initiative Privacy">
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar w-full">
        <div className="max-w-4xl mx-auto w-full p-4 md:p-6 space-y-8 pb-32">
          {/* My Initiative */}
          <div className="space-y-4">
            <h3 className="text-zinc-500 text-xs font-bold uppercase tracking-wider">My Initiative</h3>
            <div className="flex items-center group cursor-pointer">
              <div className="relative mr-4" onClick={() => myStatuses.length > 0 && onStatusClick(myStatuses)}>
                <div className="w-14 h-14 rounded-full border-2 border-white/20 p-0.5 group-hover:scale-105 transition-transform">
                  {myStatuses.length > 0 ? (
                    <div className="w-full h-full rounded-full overflow-hidden bg-white/[0.04] relative">
                      {myStatuses[0].content_type === 'video' ? (
                        <div className="relative w-full h-full">
                          <video src={myStatuses[0].content_url} muted className="w-full h-full object-cover blur-[2px]" />
                          <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                            <Play className="w-4 h-4 text-white fill-white opacity-80" />
                          </div>
                        </div>
                      ) : (
                        <Image src={myStatuses[0].content_url} alt="My Initiative" width={56} height={56} unoptimized className="object-cover h-full" />
                      )}
                    </div>
                  ) : (
                    <div className="w-full h-full rounded-full bg-white/[0.04] flex items-center justify-center">
                      <UserCircle className="w-8 h-8 text-zinc-700" />
                    </div>
                  )}
                </div>
                <label 
                  className="absolute bottom-0 right-0 w-5 h-5 bg-white rounded-full flex items-center justify-center border-2 border-black cursor-pointer hover:bg-zinc-200 transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Plus className="w-3.5 h-3.5 text-black" />
                  <input type="file" className="hidden" accept="image/*,video/*" onChange={handleFileSelect} />
                </label>
              </div>
              <div className="flex-1 min-w-0" onClick={() => myStatuses.length > 0 && onStatusClick(myStatuses)}>
                <p className="text-white font-medium text-sm">My Initiative</p>
                <p className="text-zinc-600 text-xs truncate">
                  {myStatuses.length > 0 ? 'Tap to view' : 'Add to my initiative'}
                </p>
              </div>
            </div>
          </div>

          {/* Recent Initiatives */}
          <div className="space-y-4 pt-2">
            <h3 className="text-zinc-500 text-xs font-bold uppercase tracking-wider">Recent initiatives</h3>
            {loading ? (
               <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 text-white animate-spin" /></div>
            ) : Object.keys(partnerStatuses).length === 0 ? (
               <p className="text-zinc-600 text-sm text-center py-8 bg-white/[0.02] rounded-lg">No recent initiatives.</p>
            ) : (
              <div className="space-y-1">
                {Object.entries(partnerStatuses).map(([userId, userStatuses]) => (
                  <div 
                    key={userId} 
                    className="flex items-center p-3 -mx-2 hover:bg-white/[0.03] rounded-xl cursor-pointer transition-all group"
                    onClick={() => onStatusClick(userStatuses)}
                  >
                    <div className="relative mr-4">
                      <div className="w-14 h-14 rounded-full border-2 border-white/20 p-0.5 group-hover:scale-105 transition-transform">
                        <div className="w-full h-full rounded-full overflow-hidden bg-white/[0.04] relative">
                          {userStatuses[0].content_type === 'video' ? (
                            <div className="relative w-full h-full">
                              <video src={userStatuses[0].content_url} muted className="w-full h-full object-cover blur-[2px]" />
                              <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                                <Play className="w-4 h-4 text-white fill-white opacity-80" />
                              </div>
                            </div>
                          ) : (
                            <Image src={userStatuses[0].content_url} alt="Initiative" width={56} height={56} unoptimized className="object-cover h-full" />
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="flex justify-between items-start mb-0.5">
                        <p className="text-white font-medium text-sm truncate">{userStatuses[0].user?.name || 'User'}</p>
                        <span className="text-zinc-700 text-[11px] whitespace-nowrap pt-0.5">
                          {new Date(userStatuses[0].created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-zinc-600 text-[10px] uppercase font-bold tracking-tight">
                        {userStatuses.length} Initiative{userStatuses.length > 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Upload Preview */}
      {selectedFile && (
        <div className="fixed inset-0 z-[300] bg-black flex flex-col">
          <div className="p-4 flex items-center justify-between text-white bg-black/50 backdrop-blur-md">
            <button onClick={() => setSelectedFile(null)} className="p-2 hover:bg-white/[0.06] rounded-full"><X className="w-5 h-5" /></button>
            <span className="font-medium text-sm">Send Initiative</span>
            <div className="w-10"></div>
          </div>
          <div className="flex-1 min-h-0 relative flex items-center justify-center p-4 overflow-hidden">
            {selectedFile.type.startsWith('video') ? (
              <video src={URL.createObjectURL(selectedFile)} controls className="max-w-full max-h-full rounded-2xl shadow-2xl z-10" />
            ) : (
              <div className="relative w-full h-full flex items-center justify-center">
                {selectedFile.type.startsWith('image') && (
                  <Image src={URL.createObjectURL(selectedFile)} alt="Preview" fill unoptimized className="object-contain rounded-xl z-10" />
                )}
              </div>
            )}
            <div className="absolute inset-0 opacity-30 blur-2xl scale-110">
               {selectedFile.type.startsWith('image') && <Image src={URL.createObjectURL(selectedFile)} alt="Blur bg" fill className="object-cover" />}
            </div>
          </div>
          <div className="p-4 pt-2 bg-[#0a0a0a] border-t border-white/[0.04] z-20">
            <div className="flex items-center gap-2 max-w-4xl mx-auto w-full">
              <div className="relative flex-1">
                <input 
                  type="text" placeholder="Add a caption..." autoFocus
                  className="w-full bg-white/[0.03] border border-white/[0.04] text-white rounded-xl py-3 pl-12 pr-4 focus:ring-1 focus:ring-white/10 text-sm outline-none placeholder-zinc-700"
                  value={caption} onChange={(e) => setCaption(e.target.value)}
                />
                <ImageIcon className="absolute left-4 top-3 w-5 h-5 text-zinc-600" />
              </div>
              <button 
                onClick={handleUpload} disabled={isUploading}
                className="bg-white hover:bg-zinc-200 text-black p-3 rounded-full transition-all active:scale-95 disabled:opacity-50 shrink-0"
              >
                {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {isPrivacyOpen && <StatusPrivacyModal onClose={() => setIsPrivacyOpen(false)} />}
    </div>
  )
}

function UserCircle({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08s5.97 1.09 6 3.08c-1.29 1.94-3.5 3.22-6 3.22z" />
    </svg>
  )
}
