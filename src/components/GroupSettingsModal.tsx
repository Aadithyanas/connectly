'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { X, Users, Settings, LogOut, Shield, UserX, Check, Clock, UserPlus, Globe, Lock, Loader2, Camera, Plus } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/context/AuthContext'
import { useGroups } from '@/hooks/useGroups'
import Image from 'next/image'

interface GroupSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  chatId: string
  onDetailsUpdated: (details: any) => void
}

export default function GroupSettingsModal({ isOpen, onClose, chatId, onDetailsUpdated }: GroupSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'info' | 'members' | 'requests' | 'add'>('info')
  const [chat, setChat] = useState<any>(null)
  const [members, setMembers] = useState<any[]>([])
  const [profiles, setProfiles] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [updating, setUpdating] = useState(false)
  const { user } = useAuth()
  const { inviteUser } = useGroups()
  const supabase = createClient()

  useEffect(() => {
    if (isOpen && chatId) {
      fetchData()
    }
  }, [isOpen, chatId])

  const fetchData = async () => {
    setLoading(true)
    try {
      // Fetch chat details
      const { data: chatData, error: chatError } = await supabase.from('chats').select('*').eq('id', chatId).single()
      if (chatError) throw chatError
      setChat(chatData)

      // Fetch members with profiles
      const { data: memberData, error: memberError } = await supabase
        .from('chat_members')
        .select('*, profiles(name, avatar_url, role)')
        .eq('chat_id', chatId)
      
      if (memberError) throw memberError
      setMembers(memberData || [])

      // Fetch all visible profiles for search
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, name, avatar_url, role')
        .neq('id', user?.id)
      
      setProfiles(profileData || [])
    } catch (err) {
      console.error("fetchData error:", err)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateInfo = async (e: React.FormEvent) => {
    e.preventDefault()
    setUpdating(true)
    const { error } = await supabase
      .from('chats')
      .update({
        name: chat.name,
        description: chat.description,
        is_public: chat.is_public
      })
      .eq('id', chatId)
    
    if (!error) {
       onDetailsUpdated(chat)
       setActiveTab('info')
       window.dispatchEvent(new CustomEvent('chat-updated', { detail: chat }))
       // Optionally you could add a 'Saved' toast here
    } else {
       console.error("Failed to update group settings:", error)
       alert("Failed to save changes. Make sure you are an admin.")
    }
    setUpdating(false)
  }

  const handleMemberAction = async (memberId: string, action: 'joined' | 'removed') => {
    if (action === 'removed') {
      const { error } = await supabase.from('chat_members').delete().eq('chat_id', chatId).eq('user_id', memberId)
      if (!error) {
        setMembers(prev => prev.filter(m => m.user_id !== memberId))
      } else {
        console.error("Error removing member:", error)
      }
    } else {
      // Approve action
      const { error } = await supabase.from('chat_members').update({ status: 'joined' }).eq('chat_id', chatId).eq('user_id', memberId)
      if (!error) {
        setMembers(prev => prev.map(m => m.user_id === memberId ? { ...m, status: 'joined' } : m))
      } else {
        console.error("Error approving member:", error)
        alert("Failed to approve member: " + error.message)
      }
    }
  }

  const handleInvite = async (targetUserId: string) => {
    setUpdating(true)
    const { error, status } = await inviteUser(chatId, targetUserId)
    if (!error) {
      await fetchData() // Refresh all
      setSearch('')
    }
    setUpdating(false)
  }

  const filteredProfiles = search.trim() === '' ? [] : profiles.filter(p => {
    const isMember = members.some(m => m.user_id === p.id)
    if (isMember) return false
    return (p.name || '').toLowerCase().includes(search.toLowerCase())
  })

  const myRole = members.find(m => m.user_id === user?.id)?.role
  const isAdmin = myRole === 'admin'

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
        
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-lg bg-[#0a0a0a] border border-white/[0.08] rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]"
        >
          <div className="p-6 border-b border-white/[0.04] flex items-center justify-between bg-black/40">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Settings className="w-5 h-5 text-zinc-400" />
              Community Settings
            </h3>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X className="w-5 h-5 text-zinc-500" /></button>
          </div>

          <div className="flex border-b border-white/[0.04] bg-black/20 px-4">
            <button onClick={() => setActiveTab('info')} className={`px-4 py-3 text-xs font-bold uppercase tracking-widest transition-all border-b-2 ${activeTab === 'info' ? 'border-white text-white' : 'border-transparent text-zinc-500 hover:text-white'}`}>Info</button>
            <button onClick={() => setActiveTab('members')} className={`px-4 py-3 text-xs font-bold uppercase tracking-widest transition-all border-b-2 ${activeTab === 'members' ? 'border-white text-white' : 'border-transparent text-zinc-500 hover:text-white'}`}>Members ({members.filter(m => m.status === 'joined').length})</button>
            {isAdmin && (
              <>
                <button onClick={() => setActiveTab('requests')} className={`px-4 py-3 text-xs font-bold uppercase tracking-widest transition-all border-b-2 ${activeTab === 'requests' ? 'border-white text-white' : 'border-transparent text-zinc-500 hover:text-white'}`}>Requests ({members.filter(m => m.status === 'requesting').length})</button>
                <button onClick={() => setActiveTab('add')} className={`px-4 py-3 text-xs font-bold uppercase tracking-widest transition-all border-b-2 ${activeTab === 'add' ? 'border-white text-white' : 'border-transparent text-zinc-500 hover:text-white'}`}>Add</button>
              </>
            )}
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
            {loading ? (
              <div className="flex items-center justify-center h-48"><Loader2 className="w-8 h-8 animate-spin text-zinc-500" /></div>
            ) : activeTab === 'info' ? (
              <div className="space-y-6">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-24 h-24 rounded-3xl bg-white/[0.03] border border-white/[0.1] flex items-center justify-center relative group">
                    {chat?.avatar_url ? (
                      <img src={chat.avatar_url} alt="" className="w-full h-full rounded-3xl object-cover" />
                    ) : (
                      <Users className="w-8 h-8 text-zinc-600" />
                    )}
                    {isAdmin && <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-3xl transition-all cursor-pointer"><Camera className="w-6 h-6 text-white" /></div>}
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1 mb-1 block">Name</label>
                    <input readOnly={!isAdmin} value={chat?.name || ''} onChange={(e) => setChat({...chat, name: e.target.value})} className="w-full px-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-2xl text-white outline-none focus:ring-1 focus:ring-white/10" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1 mb-1 block">Description</label>
                    <textarea readOnly={!isAdmin} value={chat?.description || ''} onChange={(e) => setChat({...chat, description: e.target.value})} rows={3} className="w-full px-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-2xl text-white outline-none focus:ring-1 focus:ring-white/10 resize-none" />
                  </div>
                  {isAdmin && (
                    <div className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/[0.05] rounded-2xl">
                      <div className="flex items-center gap-2">
                        {chat?.is_public ? <Globe className="w-4 h-4 text-zinc-400" /> : <Lock className="w-4 h-4 text-zinc-400" />}
                        <span className="text-sm">Public Visibility</span>
                      </div>
                      <button onClick={() => setChat({...chat, is_public: !chat?.is_public})} className={`w-12 h-6 rounded-full transition-all relative ${chat?.is_public ? 'bg-white' : 'bg-zinc-800'}`}>
                        <div className={`absolute top-1 w-4 h-4 rounded-full transition-all ${chat?.is_public ? 'right-1 bg-black' : 'left-1 bg-zinc-500'}`} />
                      </button>
                    </div>
                  )}
                </div>

                {isAdmin && (
                  <button onClick={handleUpdateInfo} disabled={updating} className="w-full py-4 bg-white text-black rounded-2xl font-bold hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                    {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Save Changes
                  </button>
                )}
              </div>
            ) : activeTab === 'members' ? (
              <div className="space-y-1">
                {members.filter(m => m.status === 'joined').map(member => (
                  <div key={member.user_id} className="flex items-center gap-3 p-3 hover:bg-white/[0.01] rounded-2xl group transition-colors">
                    <div className="w-10 h-10 rounded-xl bg-white/[0.05] overflow-hidden flex items-center justify-center">
                      {member.profiles?.avatar_url ? <img src={member.profiles.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="text-xs font-bold">{member.profiles?.name?.[0]}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white truncate">{member.profiles?.name}</span>
                        {member.role === 'admin' && <Shield className="w-3 h-3 text-zinc-500" />}
                        {member.user_id === user?.id && <span className="text-[9px] bg-white/10 px-1.5 py-0.5 rounded text-zinc-400">YOU</span>}
                      </div>
                      <span className="text-[10px] text-zinc-500 uppercase font-black">{member.profiles?.role}</span>
                    </div>
                    {isAdmin && member.user_id !== user?.id && (
                      <button onClick={() => handleMemberAction(member.user_id, 'removed')} className="p-2 text-zinc-600 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"><UserX className="w-4 h-4" /></button>
                    )}
                  </div>
                ))}
              </div>
            ) : activeTab === 'add' ? (
              <div className="space-y-4">
                <div className="relative">
                  <input 
                    type="text" 
                    placeholder="Search people to invite..." 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full px-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-2xl text-white outline-none focus:ring-1 focus:ring-white/10"
                  />
                </div>

                <div className="space-y-1">
                  {filteredProfiles.length === 0 && search.trim() !== '' && (
                    <p className="text-center py-8 text-zinc-600 text-sm">No users found.</p>
                  )}
                  {filteredProfiles.map(profile => (
                    <div key={profile.id} className="flex items-center gap-3 p-3 hover:bg-white/[0.02] rounded-2xl transition-colors">
                       <div className="w-10 h-10 rounded-xl bg-white/[0.05] overflow-hidden flex items-center justify-center">
                        {profile.avatar_url ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="text-xs font-bold text-zinc-500">{profile.name?.[0]}</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white truncate">{profile.name}</p>
                        <p className="text-[10px] text-zinc-500 uppercase font-black">{profile.role}</p>
                      </div>
                      <button 
                        onClick={() => handleInvite(profile.id)}
                        disabled={updating}
                        className="px-4 py-1.5 bg-white text-black rounded-xl text-[10px] font-black uppercase tracking-wider hover:scale-105 active:scale-95 transition-all flex items-center gap-1.5"
                      >
                        {profile.role === 'professional' ? <UserPlus className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                        {profile.role === 'professional' ? 'Invite' : 'Add'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {members.filter(m => m.status === 'requesting').length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-zinc-600">
                    <Clock className="w-10 h-10 mb-3 opacity-20" />
                    <p className="text-sm font-medium">No pending join requests.</p>
                  </div>
                ) : (
                  members.filter(m => m.status === 'requesting').map(member => (
                    <div key={member.user_id} className="flex items-center gap-3 p-4 bg-white/[0.02] border border-white/[0.05] rounded-2xl">
                       <div className="w-10 h-10 rounded-xl bg-white/[0.05] overflow-hidden flex items-center justify-center">
                        {member.profiles?.avatar_url ? <img src={member.profiles.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="text-xs font-bold">{member.profiles?.name?.[0]}</span>}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-white mb-0.5">{member.profiles?.name}</p>
                        <p className="text-[10px] text-zinc-500 uppercase">{member.profiles?.role}</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleMemberAction(member.user_id, 'removed')} className="p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all"><X className="w-4 h-4" /></button>
                        <button onClick={() => handleMemberAction(member.user_id, 'joined')} className="p-2 bg-white text-black rounded-lg hover:scale-110 transition-all"><Check className="w-4 h-4" /></button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="p-6 bg-black/40 border-t border-white/[0.04]">
            <button onClick={() => handleMemberAction(user?.id || '', 'removed')} className="w-full py-4 border border-red-500/20 text-red-500 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-red-500/10 transition-all flex items-center justify-center gap-2">
              <LogOut className="w-4 h-4" />
              Leave Community
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
