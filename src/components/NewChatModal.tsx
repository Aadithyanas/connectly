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
}

export default function NewChatModal({ isOpen, onClose, onChatCreated }: NewChatModalProps) {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [search, setSearch] = useState('')
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [isCreatingGroup, setIsCreatingGroup] = useState(false)
  const [groupName, setGroupName] = useState('')
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
          // Filter logic: Show students OR (professionals who are available)
          // Note: verification_level >= 0 allows seeing new pros immediately
          const visibleProfiles = data.filter((p: any) => 
            p.role === 'student' || 
            (p.role === 'professional' && p.availability_status !== false) ||
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
      // Use the database function to create/find chat (bypasses RLS)
      const { data, error } = await supabase.rpc('create_dm_chat', {
        other_user_id: otherUserId
      })

      if (error) throw error

      // data is the chat_id (UUID)
      onChatCreated(data)
      onClose()
    } catch (err) {
      console.error("Error creating chat:", err)
      alert("Could not start chat. Please check your connection.")
    } finally {
      setLoading(false)
    }
  }

  const handleCreateGroup = async () => {
    if (!groupName.trim() || selectedUsers.length === 0) return
    setLoading(true)
    
    try {
      // Use the database function to create group (bypasses RLS)
      const { data, error } = await supabase.rpc('create_group_chat', {
        group_name: groupName,
        member_ids: selectedUsers
      })

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
        const matchesName = (p.name || '').toLowerCase().includes(query)
        const matchesEmail = (p.email || '').toLowerCase().includes(query)
        const matchesCompany = p.role === 'professional' && (p.companies?.name || '').toLowerCase().includes(query)
        
        return matchesName || matchesEmail || matchesCompany
      })

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-[#222e35] w-full max-w-md rounded-2xl overflow-hidden shadow-2xl border border-white/5"
          >
            {/* Header */}
            <div className="p-4 bg-[#202c33] flex items-center justify-between border-b border-[#2a3942]">
              <div className="flex items-center gap-3">
                <button 
                  onClick={isCreatingGroup ? () => setIsCreatingGroup(false) : selectedUsers.length > 0 ? () => setSelectedUsers([]) : onClose}
                  className="p-1 hover:bg-[#374248] rounded-full transition-colors"
                >
                  <X className="w-6 h-6 text-[#8696a0]" />
                </button>
                <h2 className="text-[#e9edef] font-bold text-lg">
                  {isCreatingGroup ? 'New Group' : selectedUsers.length > 0 ? 'Add Members' : 'New Chat'}
                </h2>
              </div>
              {selectedUsers.length > 0 && !isCreatingGroup && (
                <button 
                  onClick={() => setIsCreatingGroup(true)}
                  className="text-[#00a884] font-bold py-1 px-3 rounded-lg hover:bg-[#00a884]/10 transition-colors"
                >
                  Next
                </button>
              )}
            </div>

            {/* Mode: Create Group Info */}
            {isCreatingGroup ? (
              <div className="p-6 space-y-6">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-20 h-20 bg-[#374248] rounded-full flex items-center justify-center text-[#8696a0]">
                    <Users className="w-10 h-10" />
                  </div>
                  <input 
                    type="text"
                    placeholder="Group Subject"
                    className="w-full bg-[#202c33] border-b-2 border-[#00a884] px-2 py-3 text-[#e9edef] focus:ring-0 text-xl placeholder-[#8696a0] font-medium transition-all"
                    autoFocus
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                  />
                  <p className="text-[#8696a0] text-sm italic">Provide a group subject and optional group icon</p>
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setIsCreatingGroup(false)} className="px-4 py-2 text-[#8696a0] font-bold hover:bg-[#374248] rounded-lg">Back</button>
                  <button 
                    onClick={handleCreateGroup}
                    disabled={loading || !groupName.trim()}
                    className="px-6 py-2 bg-[#00a884] text-[#111b21] font-bold rounded-lg hover:bg-[#008f6f] disabled:opacity-50 transition-all flex items-center gap-2 shadow-lg"
                  >
                    {loading ? 'Creating...' : 'Create Group'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Search */}
                <div className="p-3 bg-[#111b21]">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center">
                      <Search className="h-5 w-5 text-[#8696a0]" />
                    </div>
                    <input
                      type="text"
                      placeholder="Search by name, email or company..."
                      className="block w-full pl-10 pr-3 py-2 bg-[#202c33] border-none text-[#e9edef] rounded-xl focus:ring-0 text-sm"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                </div>

                {/* User List */}
                <div className="max-h-[400px] overflow-y-auto custom-scrollbar min-h-[100px] flex flex-col">
                  {search.trim() === '' ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                      <div className="w-16 h-16 bg-[#00a884]/10 rounded-full flex items-center justify-center mb-3">
                        <Search className="w-8 h-8 text-[#00a884] opacity-50" />
                      </div>
                      <p className="text-[#8696a0] text-sm">Type a name or email to find someone to chat with.</p>
                    </div>
                  ) : (
                    <>
                      {selectedUsers.length === 0 && (
                        <div 
                          className="flex items-center px-4 py-3 hover:bg-[#202c33] cursor-pointer group border-b border-[#2a3942] transition-colors"
                          onClick={() => setIsCreatingGroup(true)}
                        >
                          <div className="w-12 h-12 bg-[#00a884] rounded-full flex items-center justify-center mr-3 shadow-lg group-hover:scale-105 transition-transform">
                            <Users className="w-6 h-6 text-white" />
                          </div>
                          <span className="text-[#e9edef] font-medium text-[16px]">New Group</span>
                        </div>
                      )}
                      
                      {filteredProfiles.length === 0 ? (
                        <div className="p-8 text-center text-[#8696a0] text-sm italic">
                          No users found matching &quot;{search}&quot;
                        </div>
                      ) : (
                        filteredProfiles.map((profile) => {
                          const isSelected = selectedUsers.includes(profile.id)
                          return (
                            <div 
                              key={profile.id}
                              className={`flex items-center px-4 py-3 cursor-pointer border-b border-[#2a3942] group transition-all duration-200 ${isSelected ? 'bg-[#2a3942]' : 'hover:bg-[#202c33]'} ${loading ? 'opacity-50 pointer-events-none' : ''}`}
                              onClick={() => {
                                if (selectedUsers.length > 0) {
                                  setSelectedUsers(prev => prev.includes(profile.id) ? prev.filter(id => id !== profile.id) : [...prev, profile.id])
                                } else {
                                  handleCreateDM(profile.id)
                                }
                              }}
                            >
                              <div className="relative w-12 h-12 rounded-full bg-[#374248] mr-3 overflow-hidden group-hover:scale-105 transition-all">
                                {profile.avatar_url ? (
                                  <img 
                                    src={profile.avatar_url} 
                                    alt={profile.name} 
                                    className="w-full h-full object-cover" 
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center font-bold text-lg uppercase bg-[#00a884]/20 text-[#00a884]">
                                    {profile.name[0]}
                                  </div>
                                )}
                                {isSelected && (
                                  <div className="absolute inset-0 bg-[#00a884]/80 flex items-center justify-center">
                                    <Check className="w-6 h-6 text-white" />
                                  </div>
                                )}
                              </div>
                              <div className="flex-1">
                                <div className="text-[#e9edef] font-medium flex items-center gap-2">
                                  {profile.name}
                                  {profile.role === 'professional' && profile.verification_level >= 2 && (
                                    <Check className="w-3 h-3 text-[#3b82f6] fill-[#3b82f6]" />
                                  )}
                                </div>
                                <div className="text-[#8696a0] text-sm truncate">
                                  {profile.role === 'professional' ? (
                                    <span className="text-[#00a884] font-medium">
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
