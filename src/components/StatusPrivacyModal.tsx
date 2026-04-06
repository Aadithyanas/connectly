'use client'

import { useState, useEffect } from 'react'
import { X, Search, Check, Save, Loader2, Users, MessageSquare, Globe } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import Image from 'next/image'
import { useAuth } from '@/context/AuthContext'

interface Profile {
  id: string
  name: string
  avatar_url: string
}

interface StatusPrivacyModalProps {
  onClose: () => void
}

export default function StatusPrivacyModal({ onClose }: StatusPrivacyModalProps) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [visibility, setVisibility] = useState<'everyone' | 'contacts' | 'selected'>('everyone')
  const [members, setMembers] = useState<Profile[]>([])
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const { user } = useAuth()
  const supabase = createClient()

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return

      // 1. Fetch current privacy settings
      const { data: privacyData } = await supabase
        .from('status_privacy')
        .select('visibility')
        .eq('user_id', user.id)
        .single()

      if (privacyData) setVisibility(privacyData.visibility)

      // 2. Fetch allowed users if they exist
      const { data: allowedData } = await supabase
        .from('status_allowed_users')
        .select('allowed_user_id')
        .eq('status_owner_id', user.id)

      if (allowedData) {
        setSelectedMembers(new Set(allowedData.map(d => d.allowed_user_id)))
      }

      // 3. Fetch all active members from chats (to populate the picker)
      const { data: memberOf } = await supabase
        .from('chat_members')
        .select('chat_id')
        .eq('user_id', user.id)

      const chatIds = (memberOf || []).map(m => m.chat_id)
      
      if (chatIds.length > 0) {
        const { data: allMembers } = await supabase
          .from('chat_members')
          .select('user_id, profiles(id, name, avatar_url)')
          .in('chat_id', chatIds)

        const profiles = (allMembers || [])
          .map((m: any) => m.profiles)
          .filter(p => p && p.id !== user.id)
        
        // Deduplicate profiles
        const uniqueProfiles = Array.from(new Map(profiles.map(p => [p.id, p])).values())
        setMembers(uniqueProfiles)
      }

      setLoading(false)
    }

    fetchData()
  }, [supabase, user])

  const handleSave = async () => {
    setSaving(true)
    if (!user) return

    try {
      // 1. Update visibility setting
      await supabase
        .from('status_privacy')
        .upsert({ user_id: user.id, visibility })

      // 2. Update allowed users list
      if (visibility === 'selected') {
        // Clear old ones then insert new ones
        await supabase
          .from('status_allowed_users')
          .delete()
          .eq('status_owner_id', user.id)

        const insertData = Array.from(selectedMembers).map(id => ({
          status_owner_id: user.id,
          allowed_user_id: id
        }))

        if (insertData.length > 0) {
          await supabase.from('status_allowed_users').insert(insertData)
        }
      }

      onClose()
    } catch (err) {
      console.error('Failed to save status privacy:', err)
    } finally {
      setSaving(false)
    }
  }

  const toggleMember = (id: string) => {
    const next = new Set(selectedMembers)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedMembers(next)
  }

  const filteredMembers = members.filter(m => 
    m.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="absolute inset-0 z-[200] bg-black/80 backdrop-blur-xl flex flex-col pt-10">
      <div className="flex items-center justify-between px-6 mb-8 text-white">
        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X className="w-6 h-6" /></button>
        <h2 className="text-xl font-bold">Status Privacy</h2>
        <button 
            disabled={saving}
            onClick={handleSave} 
            className="p-2 bg-[#00a884] hover:bg-[#06cf9c] rounded-full text-white shadow-lg disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar px-6 space-y-8 pb-10">
        {loading ? (
             <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 text-[#00a884] animate-spin" /></div>
        ) : (
          <>
            {/* Visibility Options */}
            <div className="space-y-4">
              <p className="text-[#8696a0] text-sm uppercase font-semibold tracking-wider">Who can see my status updates</p>
              
              <div className="space-y-2">
                {[
                  { id: 'everyone', label: 'Everyone', icon: Globe, desc: 'All registered Connectly members' },
                  { id: 'contacts', label: 'My Chats', icon: Users, desc: 'Only people you have chatted with' },
                  { id: 'selected', label: 'Selected Members', icon: MessageSquare, desc: 'Specifically chosen individuals' }
                ].map((opt) => (
                  <label 
                    key={opt.id} 
                    className={`flex items-center p-4 rounded-2xl cursor-pointer border-2 transition-all ${visibility === opt.id ? 'bg-[#00a884]/10 border-[#00a884]' : 'bg-[#202c33] border-transparent hover:bg-[#2a3942]'}`}
                    onClick={() => setVisibility(opt.id as any)}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <opt.icon className={`w-5 h-5 ${visibility === opt.id ? 'text-[#00a884]' : 'text-[#8696a0]'}`} />
                        <p className="text-[#e9edef] font-medium">{opt.label}</p>
                      </div>
                      <p className="text-[#8696a0] text-xs pl-8">{opt.desc}</p>
                    </div>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${visibility === opt.id ? 'bg-[#00a884] border-[#00a884]' : 'border-[#8696a0]'}`}>
                      {visibility === opt.id && <Check className="w-4 h-4 text-white" />}
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Member Picker (only for 'selected') */}
            {visibility === 'selected' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-5 duration-300">
                <div className="flex items-center justify-between">
                    <p className="text-[#8696a0] text-sm uppercase font-semibold tracking-wider">Choose Members ({selectedMembers.size})</p>
                    {selectedMembers.size > 0 && <button onClick={() => setSelectedMembers(new Set())} className="text-[#00a884] text-xs hover:underline">Clear all</button>}
                </div>

                <div className="relative">
                  <input 
                    type="text" 
                    placeholder="Search people..." 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-[#202c33] border-none text-[#e9edef] rounded-xl py-3 pl-12 focus:ring-1 focus:ring-[#00a884] placeholder-[#8696a0]"
                  />
                  <Search className="absolute left-4 top-3.5 w-5 h-5 text-[#8696a0]" />
                </div>

                <div className="space-y-1">
                  {filteredMembers.length === 0 ? (
                    <p className="text-center py-10 text-[#8696a0] italic">No members found.</p>
                  ) : (
                    filteredMembers.map(member => (
                      <div 
                        key={member.id} 
                        onClick={() => toggleMember(member.id)}
                        className="flex items-center p-3 rounded-xl hover:bg-[#202c33] cursor-pointer transition-colors group"
                      >
                         <div className="w-10 h-10 rounded-full overflow-hidden mr-4 shadow-md group-hover:scale-105 transition-transform">
                           {member.avatar_url ? (
                              <Image src={member.avatar_url} alt={member.name} width={40} height={40} className="object-cover" />
                           ) : (
                              <div className="w-full h-full bg-[#00a884] flex items-center justify-center text-white font-bold">{member.name[0]}</div>
                           )}
                         </div>
                         <p className="flex-1 text-[#e9edef] font-medium">{member.name}</p>
                         <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${selectedMembers.has(member.id) ? 'bg-[#00a884] border-[#00a884]' : 'border-[#8696a0]'}`}>
                           {selectedMembers.has(member.id) && <Check className="w-3.5 h-3.5 text-white" />}
                         </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
