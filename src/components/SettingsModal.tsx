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
      <label className="text-sm text-[#e9edef] font-medium flex items-center gap-2">
         <Type className="w-4 h-4 text-[#00a884]"/> Text Size
      </label>
      <div className="flex gap-2">
        {['small', 'medium', 'large'].map((size) => (
          <button
            key={size}
            onClick={() => setLocalSettings(prev => ({ ...prev, textSize: size as any }))}
            className={`flex-1 py-2 text-sm rounded-md transition-colors capitalize ${
              localSettings.textSize === size 
                ? 'bg-[#00a884] text-[#111b21] font-semibold' 
                : 'bg-[#202c33] hover:bg-[#2a3942] text-[#8696a0]'
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
    <div className="fixed inset-0 z-[99999] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#111b21] w-full max-w-md rounded-xl shadow-2xl border border-[#2a3942] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 text-left">
        <div className="flex items-center justify-between p-4 border-b border-[#2a3942] bg-[#202c33]">
           <h2 className="text-[#e9edef] text-lg font-semibold capitalize">
             {type === 'sidebar' ? 'Application Settings' : 'Chat Options'}
           </h2>
           <button onClick={onClose} className="p-1 hover:bg-[#374248] rounded-full text-[#8696a0] transition-colors">
             <X className="w-5 h-5"/>
           </button>
        </div>

        <div className="p-6 flex flex-col gap-8 flex-1 overflow-y-auto custom-scrollbar">
          {/* Text Size (Always available) */}
          {renderTextSize()}

          {/* Report Option (Only in chat) */}
          {type === 'chat' && otherUserId && (
             <div className="pt-4 border-t border-[#2a3942]">
                <p className="text-xs text-[#8696a0] mb-3 font-medium uppercase tracking-wider">Privacy & Safety</p>
                <button 
                  onClick={() => setShowReportModal(true)}
                  className="w-full flex items-center justify-between p-4 bg-[#ea0038]/10 hover:bg-[#ea0038]/20 border border-[#ea0038]/30 rounded-xl group transition-all"
                >
                   <div className="flex items-center gap-3">
                      <AlertTriangle className="w-5 h-5 text-[#ea0038]" />
                      <div className="text-left">
                         <p className="text-[#ea0038] text-sm font-bold">Report {otherUserName || 'User'}</p>
                         <p className="text-[#8696a0] text-[11px]">Flag inappropriate or unofficial behavior</p>
                      </div>
                   </div>
                </button>
             </div>
          )}
        </div>

        <div className="p-4 border-t border-[#2a3942] bg-[#202c33] flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm text-[#8696a0] hover:text-[#e9edef] transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-2 bg-[#00a884] hover:bg-[#008f6f] disabled:opacity-70 disabled:cursor-not-allowed text-[#111b21] font-medium text-sm rounded-md transition-colors min-w-[130px] justify-center"
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
