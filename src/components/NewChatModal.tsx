'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { X, Search, User, Users, ChevronRight, Check, Plus } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import { useAuth } from '@/context/AuthContext'

interface Profile {
  id: string
  name: string
  email: string
  avatar_url: string | null
  role: string | null
  job_role: string | null
  verification_level: number
  availability_status: boolean
  companies?: { name: string } | null
}

interface NewChatModalProps {
  isOpen: boolean
  onClose: () => void
  onChatCreated: (chatId: string) => void
  onOpenNewGroup: () => void
}

export default function NewChatModal({ isOpen, onClose, onChatCreated, onOpenNewGroup }: NewChatModalProps) {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [search, setSearch] = useState('')
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [isCreatingGroup, setIsCreatingGroup] = useState(false)
  const [loading, setLoading] = useState(false)
  const { user } = useAuth()
  const supabase = createClient()

  useEffect(() => {
    if (isOpen && user) {
      const fetchProfiles = async () => {
        if (!user) return
        const { data, error } = await supabase
          .from('profiles')
          .select('id, name, email, avatar_url, role, job_role, verification_level, availability_status, companies(name)')
          .neq('id', user.id)
        
        if (!error && data) {
          // If the current user is a student, they see students AND available professionals.
          // If the current user is a professional, they see students AND available professionals.
          const visibleProfiles = data.filter((p: any) => 
            p.role === 'student' || 
            p.availability_status === true || 
            p.availability_status === null ||
            !p.role
          )
          setProfiles(visibleProfiles)
        }
      }
      fetchProfiles()
    }
  }, [isOpen, user, supabase])

  const handleCreateDM = async (otherUserId: string) => {
    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('create_dm_chat', { other_user_id: otherUserId })
      if (error) throw error
      onChatCreated(data)
      onClose()
    } catch (err) {
      console.error("Error creating chat:", err)
      alert("Could not start chat.")
    } finally {
      setLoading(false)
    }
  }

  const handleCreateGroup = async () => {
    if (!groupName.trim() || selectedUsers.length === 0) return
    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('create_group_chat', { group_name: groupName, member_ids: selectedUsers })
      if (error) throw error
      onChatCreated(data)
      onClose()
    } catch (err) {
      console.error("Error creating group:", err)
      alert("Could not create group.")
    } finally {
      setLoading(false)
    }
  }

  const filteredProfiles = search.trim() === '' 
    ? [] 
    : profiles.filter(p => {
        const query = search.toLowerCase()
        return (p.name || '').toLowerCase().includes(query) || (p.email || '').toLowerCase().includes(query) || (p.role === 'professional' && (p.companies?.name || '').toLowerCase().includes(query))
      })

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            className="bg-[#0a0a0a] w-full h-full md:h-auto md:max-w-md md:rounded-2xl overflow-hidden shadow-2xl border border-white/[0.06] flex flex-col"
          >
            {/* Header */}
              <div className="p-4 bg-[#0a0a0a] flex items-center justify-between border-b border-white/[0.04]">
                <div className="flex items-center gap-3">
                  <button 
                    onClick={onClose}
                    className="p-1 hover:bg-white/[0.06] rounded-full transition-colors"
                  >
                    <X className="w-5 h-5 text-zinc-500" />
                  </button>
                  <h2 className="text-white font-bold text-base">New Chat</h2>
                </div>
              </div>

            {isCreatingGroup ? (
              <div className="p-6 space-y-6">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 bg-white/[0.06] rounded-full flex items-center justify-center text-zinc-500">
                    <Users className="w-8 h-8" />
                  </div>
                  <input 
                    type="text"
                    placeholder="Group Subject"
                    className="w-full bg-transparent border-b border-white/[0.1] px-2 py-3 text-white focus:ring-0 focus:border-white/30 text-lg placeholder-zinc-700 font-medium transition-all outline-none"
                    autoFocus
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                  />
                  <p className="text-zinc-600 text-sm">Provide a group subject</p>
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setIsCreatingGroup(false)} className="px-4 py-2 text-zinc-500 font-bold hover:bg-white/[0.04] rounded-lg text-sm">Back</button>
                  <button 
                    onClick={handleCreateGroup}
                    disabled={loading || !groupName.trim()}
                    className="px-6 py-2 bg-white text-black font-bold rounded-lg hover:bg-zinc-200 disabled:opacity-50 transition-all flex items-center gap-2 text-sm"
                  >
                    {loading ? 'Creating...' : 'Create Group'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="p-3 border-b border-white/[0.03]">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center">
                      <Search className="h-4 w-4 text-zinc-600" />
                    </div>
                    <input
                      type="text"
                      placeholder="Search by name, email or company..."
                      className="block w-full pl-10 pr-3 py-2 bg-white/[0.03] border border-white/[0.04] text-white rounded-xl focus:ring-1 focus:ring-white/10 text-sm placeholder-zinc-700 outline-none"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                </div>

                <div className="max-h-[400px] overflow-y-auto custom-scrollbar min-h-[100px] flex flex-col">
                  {search.trim() === '' ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                      <div className="w-14 h-14 bg-white/[0.04] rounded-full flex items-center justify-center mb-3">
                        <Search className="w-7 h-7 text-zinc-700" />
                      </div>
                      <p className="text-zinc-600 text-sm">Type a name or email to find someone.</p>
                    </div>
                  ) : (
                    <>
                      {selectedUsers.length === 0 && (
                        <div 
                          className="flex items-center px-4 py-3 hover:bg-white/[0.03] cursor-pointer group border-b border-white/[0.03] transition-colors"
                          onClick={() => {
                            onClose()
                            onOpenNewGroup()
                          }}
                        >
                          <div className="w-11 h-11 bg-white rounded-full flex items-center justify-center mr-3 group-hover:scale-105 transition-transform">
                            <Users className="w-5 h-5 text-black" />
                          </div>
                          <span className="text-white font-medium text-sm">New Group</span>
                        </div>
                      )}
                      
                      {filteredProfiles.length === 0 ? (
                        <div className="p-8 text-center text-zinc-600 text-sm">
                          No users found matching &quot;{search}&quot;
                        </div>
                      ) : (
                        filteredProfiles.map((profile) => {
                          const isSelected = selectedUsers.includes(profile.id)
                          return (
                            <div 
                              key={profile.id}
                              className={`flex items-center px-4 py-3 cursor-pointer border-b border-white/[0.03] group transition-all duration-150 ${isSelected ? 'bg-white/[0.04]' : 'hover:bg-white/[0.02]'} ${loading ? 'opacity-50 pointer-events-none' : ''}`}
                              onClick={() => {
                                if (selectedUsers.length > 0) {
                                  setSelectedUsers(prev => prev.includes(profile.id) ? prev.filter(id => id !== profile.id) : [...prev, profile.id])
                                } else {
                                  handleCreateDM(profile.id)
                                }
                              }}
                            >
                              <div className="relative w-11 h-11 rounded-full bg-white/[0.06] mr-3 overflow-hidden">
                                {profile.avatar_url ? (
                                  <img src={profile.avatar_url} alt={profile.name} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center font-bold text-base uppercase bg-white/[0.06] text-zinc-400">
                                    {profile.name[0]}
                                  </div>
                                )}
                                {isSelected && (
                                  <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                                    <Check className="w-5 h-5 text-black" />
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-white font-medium text-sm flex items-center gap-2">
                                  {profile.name}
                                  {profile.role === 'professional' && profile.verification_level >= 2 && (
                                    <Check className="w-3 h-3 text-zinc-400" />
                                  )}
                                </div>
                                <div className="text-zinc-600 text-xs truncate">
                                  {profile.role === 'professional' ? (
                                    <span className="text-zinc-400 font-medium">
                                      {profile.job_role || 'Professional'} @ {profile.companies?.name || 'Unknown'}
                                    </span>
                                  ) : (
                                    profile.email
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        })
                      )}
                    </>
                  )}
                </div>
              </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
