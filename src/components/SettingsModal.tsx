'use client'

import { useState, useEffect } from 'react'
import { X, Type, Loader2, AlertTriangle } from 'lucide-react'
import { useSettings, AppSettings } from '@/hooks/useSettings'
import ReportModal from './ReportModal'

interface SettingsModalProps {
  type: 'sidebar' | 'chat'
  onClose: () => void
  otherUserId?: string
  otherUserName?: string
}

export default function SettingsModal({ type, onClose, otherUserId, otherUserName }: SettingsModalProps) {
  const { settings, updateSettings, isLoaded } = useSettings()
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings)
  const [isSaving, setIsSaving] = useState(false)
  const [showReportModal, setShowReportModal] = useState(false)

  useEffect(() => {
    if (isLoaded) setLocalSettings(settings)
  }, [settings, isLoaded])

  if (!isLoaded) return null

  const handleSave = async () => {
    setIsSaving(true)
    await new Promise(r => setTimeout(r, 400))
    updateSettings(localSettings)
    setIsSaving(false)
    onClose()
  }

  const renderTextSize = () => (
    <div className="flex flex-col gap-2">
      <label className="text-sm text-white font-medium flex items-center gap-2">
         <Type className="w-4 h-4 text-zinc-400"/> Text Size
      </label>
      <div className="flex gap-2">
        {['small', 'medium', 'large'].map((size) => (
          <button
            key={size}
            onClick={() => setLocalSettings(prev => ({ ...prev, textSize: size as any }))}
            className={`flex-1 py-2 text-sm rounded-md transition-colors capitalize ${
              localSettings.textSize === size 
                ? 'bg-white text-black font-semibold' 
                : 'bg-white/[0.04] hover:bg-white/[0.08] text-zinc-500'
            }`}
          >
            {size}
          </button>
        ))}
      </div>
    </div>
  )

  if (showReportModal && otherUserId) {
    return (
      <ReportModal 
        reportedUserId={otherUserId} 
        reportedUserName={otherUserName || 'User'} 
        onClose={() => setShowReportModal(false)} 
      />
    )
  }

  return (
    <div className="fixed inset-0 z-[99999] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-[#0a0a0a] w-full max-w-md rounded-xl shadow-2xl border border-white/[0.06] overflow-hidden flex flex-col text-left">
        <div className="flex items-center justify-between p-4 border-b border-white/[0.04]">
           <h2 className="text-white text-base font-bold">
             {type === 'sidebar' ? 'Settings' : 'Chat Options'}
           </h2>
           <button onClick={onClose} className="p-1 hover:bg-white/[0.06] rounded-full text-zinc-500 transition-colors">
             <X className="w-5 h-5"/>
           </button>
        </div>

        <div className="p-6 flex flex-col gap-8 flex-1 overflow-y-auto custom-scrollbar">
          {renderTextSize()}

          {type === 'chat' && otherUserId && (
             <div className="pt-4 border-t border-white/[0.04]">
                <p className="text-xs text-zinc-600 mb-3 font-bold uppercase tracking-wider">Privacy & Safety</p>
                <button 
                  onClick={() => setShowReportModal(true)}
                  className="w-full flex items-center justify-between p-4 bg-red-500/[0.06] hover:bg-red-500/[0.1] border border-red-500/10 rounded-xl group transition-all"
                >
                   <div className="flex items-center gap-3">
                      <AlertTriangle className="w-5 h-5 text-red-400" />
                      <div className="text-left">
                         <p className="text-red-400 text-sm font-bold">Report {otherUserName || 'User'}</p>
                         <p className="text-zinc-600 text-[11px]">Flag inappropriate behavior</p>
                      </div>
                   </div>
                </button>
             </div>
          )}
        </div>

        <div className="p-4 border-t border-white/[0.04] flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm text-zinc-500 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-2 bg-white hover:bg-zinc-200 disabled:opacity-70 text-black font-medium text-sm rounded-md transition-colors min-w-[120px] justify-center"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <span>Save Changes</span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
