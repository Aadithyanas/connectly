'use client'

import { useState, useEffect } from 'react'
import { X, Image as ImageIcon, Type, PaintBucket, Loader2 } from 'lucide-react'
import { useSettings, AppSettings } from '@/hooks/useSettings'

interface SettingsModalProps {
  type: 'sidebar' | 'chat'
  onClose: () => void
}

export default function SettingsModal({ type, onClose }: SettingsModalProps) {
  const { settings, updateSettings, isLoaded } = useSettings()
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (isLoaded) setLocalSettings(settings)
  }, [settings, isLoaded])

  if (!isLoaded) return null

  const handleSave = async () => {
    setIsSaving(true)
    // Add artificial delay for loading satisfaction
    await new Promise(r => setTimeout(r, 600))
    updateSettings(localSettings)
    setIsSaving(false)
    onClose()
  }

  const renderColorOrImageInput = (label: string, field: keyof AppSettings) => (
    <div className="flex flex-col gap-2 relative">
      <label className="text-sm text-[#e9edef] font-medium flex items-center gap-2">
         {field.includes('Bg') ? <ImageIcon className="w-4 h-4 text-[#00a884]"/> : <PaintBucket className="w-4 h-4 text-[#00a884]"/>}
         {label}
      </label>
      <div className="flex items-center gap-3">
        <div className="relative w-10 h-10 rounded-md border border-[#2a3942] overflow-hidden shrink-0 shadow-inner">
           {localSettings[field].startsWith('http') || localSettings[field].startsWith('/') ? (
              <img src={localSettings[field]} className="w-full h-full object-cover" alt="preview" />
           ) : (
              <div className="w-full h-full" style={{ backgroundColor: localSettings[field] }}></div>
           )}
           <input 
             type="color" 
             value={localSettings[field].startsWith('#') ? localSettings[field] : '#ffffff'} 
             onChange={(e) => setLocalSettings(prev => ({ ...prev, [field]: e.target.value }))}
             className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
           />
        </div>
        <input 
          type="text" 
          value={localSettings[field]}
          onChange={(e) => setLocalSettings(prev => ({ ...prev, [field]: e.target.value }))}
          placeholder="Hex color (#000000) or Image URL"
          className="flex-1 bg-[#202c33] border border-[#2a3942] rounded-md px-3 py-2 text-[#e9edef] text-sm focus:outline-none focus:border-[#00a884] transition-colors"
        />
      </div>
    </div>
  )

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

  return (
    <div className="fixed inset-0 z-[99999] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#111b21] w-full max-w-md rounded-xl shadow-2xl border border-[#2a3942] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-4 border-b border-[#2a3942] bg-[#202c33]">
           <h2 className="text-[#e9edef] text-lg font-semibold capitalize">
             {type === 'sidebar' ? 'Sidebar Settings' : 'Chat Settings'}
           </h2>
           <button onClick={onClose} className="p-1 hover:bg-[#374248] rounded-full text-[#8696a0] transition-colors">
             <X className="w-5 h-5"/>
           </button>
        </div>

        <div className="p-6 flex flex-col gap-6 flex-1 overflow-y-auto custom-scrollbar">
          {type === 'sidebar' && (
            <>
              {renderColorOrImageInput('Sidebar Background', 'sidebarBg')}
              {renderTextSize()}
            </>
          )}

          {type === 'chat' && (
            <>
              {renderColorOrImageInput('Chat Wall Background', 'chatBg')}
              {renderColorOrImageInput('Sent Bubble Color', 'sentBubbleColor')}
              {renderColorOrImageInput('Received Bubble Color', 'receivedBubbleColor')}
              {renderTextSize()}
            </>
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
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <span>Save Changes</span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
