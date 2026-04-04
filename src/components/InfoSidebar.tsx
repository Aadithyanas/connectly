'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { X, Camera, Edit2, Check, User, Users, ShieldCheck, LogOut, Trash2, Mail, Phone, Info } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import { isUserOnline, useIsUserOnline } from '@/hooks/useOnlineStatus'

interface InfoSidebarProps {
  isOpen: boolean
  onClose: () => void
  type: 'profile' | 'contact' | 'group'
  data?: any
}

export default function InfoSidebar({ isOpen, onClose, type, data }: InfoSidebarProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [name, setName] = useState(data?.name || '')
  const [bio, setBio] = useState(data?.bio || '')
  const [nickname, setNickname] = useState('')
  const [isEditingNickname, setIsEditingNickname] = useState(false)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    setName(data?.name || '')
    setBio(data?.bio || data?.description || '')
    setIsEditing(false)
    setIsEditingNickname(false)

    // Load saved nickname from localStorage for contact type
    if (type === 'contact' && data?.id) {
      const saved = localStorage.getItem(`nickname_${data.id}`)
      setNickname(saved || '')
    }
  }, [data, type])

  const handleUpdateProfile = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase
      .from('profiles')
      .update({ name, bio })
      .eq('id', user.id)

    if (!error) setIsEditing(false)
    setLoading(false)
  }

  const handleSaveNickname = () => {
    if (data?.id) {
      if (nickname.trim()) {
        localStorage.setItem(`nickname_${data.id}`, nickname.trim())
      } else {
        localStorage.removeItem(`nickname_${data.id}`)
      }
    }
    setIsEditingNickname(false)
  }

  const getTitle = () => {
    if (type === 'profile') return 'Profile'
    if (type === 'contact') return 'Contact Info'
    return 'Group Info'
  }

  const isContactOnline = useIsUserOnline(type === 'contact' ? data : null)

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="absolute inset-y-0 right-0 z-40 flex w-full h-full bg-black/40 backdrop-blur-[2px]">
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="ml-auto w-full max-w-[400px] bg-[#111b21] border-l border-[#2a3942] flex flex-col shadow-2xl shadow-black/80"
          >
            {/* Header */}
            <div className="h-[120px] bg-[#202c33] flex items-end px-6 pb-4 relative overflow-hidden">
               <div className="absolute top-4 left-4">
                 <button onClick={onClose} className="p-2 hover:bg-[#374248] rounded-full transition-colors text-[#8696a0]">
                    <X className="w-6 h-6" />
                 </button>
               </div>
               <h2 className="text-[#e9edef] text-xl font-bold">{getTitle()}</h2>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8 bg-[#111b21]">
               {/* Avatar Section */}
               <div className="flex flex-col items-center gap-4">
                 <div className="relative group cursor-pointer">
                    <div className="w-48 h-48 rounded-full bg-[#374248] flex items-center justify-center overflow-hidden border-4 border-[#111b21] shadow-xl group-hover:scale-[1.02] transition-transform relative">
                      {data?.avatar_url ? (
                        <Image 
                          src={data.avatar_url} 
                          alt="Profile" 
                          fill 
                          sizes="192px"
                          className="object-cover" 
                        />
                      ) : (
                        <User className="w-24 h-24 text-[#8696a0]" />
                      )}
                    </div>
                    {type === 'profile' && (
                      <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                         <Camera className="w-10 h-10 text-white" />
                      </div>
                    )}
                    {/* Online dot for contacts */}
                    {type === 'contact' && isContactOnline && (
                      <div className="absolute bottom-2 right-2 w-5 h-5 bg-[#25d366] rounded-full border-3 border-[#111b21] shadow-[0_0_8px_rgba(37,211,102,0.6)]"></div>
                    )}
                 </div>

                 {/* Contact name display */}
                 {type === 'contact' && (
                   <div className="text-center">
                     <h3 className="text-[#e9edef] text-2xl font-bold">{nickname || data?.name || 'Unknown'}</h3>
                     {isContactOnline ? (
                       <span className="text-[#25d366] text-sm font-medium">online</span>
                     ) : (
                       <span className="text-[#8696a0] text-sm">offline</span>
                     )}
                   </div>
                 )}
               </div>

               {/* Info Rows */}
               <div className="space-y-6">

                 {/* === PROFILE MODE === */}
                 {type === 'profile' && (
                   <>
                     <div className="space-y-2">
                        <label className="text-[#00a884] text-sm font-medium uppercase tracking-wider">Your Name</label>
                        <div className="flex items-center justify-between group">
                           {isEditing ? (
                             <input 
                               type="text" 
                               className="w-full bg-transparent border-b-2 border-[#00a884] py-1 text-[#e9edef] text-lg focus:ring-0 outline-none"
                               value={name}
                               onChange={(e) => setName(e.target.value)}
                             />
                           ) : (
                             <span className="text-[#e9edef] text-lg font-medium">{name || 'Add a name'}</span>
                           )}
                           {!isEditing && (
                             <button onClick={() => setIsEditing(true)} className="p-2 text-[#8696a0] hover:text-[#e9edef] opacity-0 group-hover:opacity-100 transition-opacity">
                                <Edit2 className="w-5 h-5" />
                             </button>
                           )}
                        </div>
                     </div>

                     <div className="space-y-2">
                        <label className="text-[#00a884] text-sm font-medium uppercase tracking-wider">About</label>
                        <div className="flex items-start justify-between group">
                           {isEditing ? (
                             <textarea 
                               className="w-full bg-transparent border-b-2 border-[#00a884] py-1 text-[#e9edef] focus:ring-0 outline-none min-h-[80px]"
                               value={bio}
                               onChange={(e) => setBio(e.target.value)}
                             />
                           ) : (
                             <p className="text-[#8696a0] leading-relaxed">{bio || 'Hey there! I am using Connectly.'}</p>
                           )}
                        </div>
                     </div>

                     {isEditing && (
                       <div className="flex justify-end gap-3 pt-4">
                          <button onClick={() => setIsEditing(false)} disabled={loading} className="px-4 py-2 text-[#8696a0] font-bold hover:bg-[#374248] rounded-lg">Cancel</button>
                          <button onClick={handleUpdateProfile} disabled={loading} className="px-6 py-2 bg-[#00a884] text-[#111b21] font-bold rounded-lg hover:bg-[#008f6f] transition-all shadow-lg">
                            {loading ? 'Saving...' : 'Save'}
                          </button>
                       </div>
                     )}
                   </>
                 )}

                 {/* === CONTACT MODE (1-on-1 chat) === */}
                 {type === 'contact' && (
                   <>
                     {/* Custom Nickname */}
                     <div className="bg-[#202c33] rounded-xl p-4 space-y-2">
                        <label className="text-[#00a884] text-xs font-medium uppercase tracking-wider">Nickname (only visible to you)</label>
                        <div className="flex items-center justify-between gap-2">
                           {isEditingNickname ? (
                             <div className="flex items-center gap-2 w-full">
                               <input 
                                 type="text" 
                                 className="flex-1 bg-transparent border-b-2 border-[#00a884] py-1 text-[#e9edef] text-lg focus:ring-0 outline-none"
                                 value={nickname}
                                 onChange={(e) => setNickname(e.target.value)}
                                 placeholder={data?.name || 'Set a nickname...'}
                                 autoFocus
                               />
                               <button onClick={handleSaveNickname} className="p-2 text-[#00a884] hover:text-[#25d366]">
                                 <Check className="w-5 h-5" />
                               </button>
                             </div>
                           ) : (
                             <>
                               <span className="text-[#e9edef] text-lg">{nickname || 'Not set'}</span>
                               <button onClick={() => setIsEditingNickname(true)} className="p-2 text-[#8696a0] hover:text-[#e9edef] transition-colors">
                                  <Edit2 className="w-4 h-4" />
                               </button>
                             </>
                           )}
                        </div>
                     </div>

                     {/* Real Name */}
                     <div className="space-y-2">
                        <label className="text-[#00a884] text-xs font-medium uppercase tracking-wider">Name</label>
                        <p className="text-[#e9edef] text-lg font-medium">{data?.name || 'Unknown'}</p>
                     </div>

                     {/* Email */}
                     <div className="space-y-2">
                        <label className="text-[#00a884] text-xs font-medium uppercase tracking-wider">Email</label>
                        <div className="flex items-center gap-3">
                          <Mail className="w-5 h-5 text-[#8696a0]" />
                          <p className="text-[#8696a0]">{data?.email || 'Not available'}</p>
                        </div>
                     </div>

                     {/* About */}
                     <div className="space-y-2">
                        <label className="text-[#00a884] text-xs font-medium uppercase tracking-wider">About</label>
                        <div className="flex items-center gap-3">
                          <Info className="w-5 h-5 text-[#8696a0] shrink-0" />
                          <p className="text-[#8696a0]">{data?.bio || 'Hey there! I am using Connectly.'}</p>
                        </div>
                     </div>
                   </>
                 )}

                 {/* === GROUP MODE === */}
                 {type === 'group' && (
                   <>
                     <div className="space-y-2">
                        <label className="text-[#00a884] text-sm font-medium uppercase tracking-wider">Group Name</label>
                        <span className="text-[#e9edef] text-lg font-medium block">{data?.name || 'Unnamed Group'}</span>
                     </div>
                     <div className="space-y-4 pt-4 border-t border-[#2a3942]">
                        <div className="flex items-center justify-between text-[#8696a0]">
                           <span className="text-sm font-medium">{data?.members?.length || 0} Members</span>
                           <Users className="w-5 h-5" />
                        </div>
                     </div>
                   </>
                 )}
               </div>

               {/* Danger Zone */}
               <div className="pt-8 space-y-4">
                  {type === 'profile' && (
                    <button className="w-full flex items-center gap-4 p-4 text-[#f15c6d] hover:bg-red-500/5 rounded-xl transition-all font-medium border border-red-500/10 group">
                       <LogOut className="w-6 h-6 group-hover:scale-110 transition-transform" />
                       <span>Logout Account</span>
                    </button>
                  )}
                  {type === 'contact' && (
                    <button className="w-full flex items-center gap-4 p-4 text-[#f15c6d] hover:bg-red-500/5 rounded-xl transition-all font-medium border border-red-500/10 group">
                       <Trash2 className="w-6 h-6 group-hover:scale-110 transition-transform" />
                       <span>Delete Chat</span>
                    </button>
                  )}
                  {type === 'group' && (
                    <button className="w-full flex items-center gap-4 p-4 text-[#f15c6d] hover:bg-red-500/5 rounded-xl transition-all font-medium border border-red-500/10 group">
                       <Trash2 className="w-6 h-6 group-hover:scale-110 transition-transform" />
                       <span>Delete Group</span>
                    </button>
                  )}
               </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
