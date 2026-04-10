'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { X, Search, User, Users, ChevronRight, Check, Plus, ArrowLeft, Shield, Globe, Lock } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import { useAuth } from '@/context/AuthContext'
import { useGroups } from '@/hooks/useGroups'

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

interface NewGroupModalProps {
  isOpen: boolean
  onClose: () => void
  onGroupCreated: (groupId: string) => void
}

export default function NewGroupModal({ isOpen, onClose, onGroupCreated }: NewGroupModalProps) {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [search, setSearch] = useState('')
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [step, setStep] = useState<'members' | 'details'>('members')
  const [groupName, setGroupName] = useState('')
  const [description, setDescription] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const { user } = useAuth()
  const { createGroup, loading } = useGroups()
  const supabase = createClient()

  useEffect(() => {
    if (isOpen && user) {
      const fetchProfiles = async () => {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, name, email, avatar_url, role, job_role, verification_level, availability_status, companies(name)')
          .neq('id', user.id)
        
        if (!error && data) {
          setProfiles(data)
        }
      }
      fetchProfiles()
    }
    
    if (!isOpen) {
      // Reset state on close
      setStep('members')
      setSelectedUsers([])
      setGroupName('')
      setDescription('')
      setError(null)
      setSearch('')
    }
  }, [isOpen, user, supabase])

  const handleCreate = async () => {
    if (!groupName.trim()) {
      setError('Please enter a community name')
      return
    }
    
    setError(null)
    const { data, error: createError } = await createGroup(groupName, description, isPublic, selectedUsers)
    
    if (createError) {
      setError(createError)
    } else if (data) {
      onGroupCreated(data.id)
      onClose()
    }
  }

  const filteredProfiles = profiles.filter(p => {
    const query = search.toLowerCase()
    return (p.name || '').toLowerCase().includes(query) || 
           (p.email || '').toLowerCase().includes(query)
  })

  const toggleUser = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId) 
        : [...prev, userId]
    )
  }

  const handleNext = () => {
    if (selectedUsers.length === 0) {
      setError('Please select at least one member')
      return
    }
    setError(null)
    setStep('details')
  }

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="bg-[#0f0f0f] w-full max-w-lg rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/10 flex flex-col relative max-h-[85vh]"
          >
            {/* Header */}
            <div className="p-6 border-b border-white/5 flex items-center justify-between bg-gradient-to-b from-white/[0.02] to-transparent shrink-0">
              <div className="flex items-center gap-4">
                {step === 'details' ? (
                  <button onClick={() => setStep('members')} className="p-2 hover:bg-white/5 rounded-full text-zinc-400 transition-all">
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                ) : (
                  <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-zinc-400 transition-all">
                    <X className="w-5 h-5" />
                  </button>
                )}
                <div>
                  <h2 className="text-xl font-bold text-white leading-none mb-1">
                    {step === 'members' ? 'Add Members' : 'New Community'}
                  </h2>
                  <p className="text-xs text-zinc-500 font-medium tracking-wide uppercase">
                    {step === 'members' ? `${selectedUsers.length} SELECTED` : 'STEP 2 OF 2'}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col">
              {step === 'members' ? (
                <div className="flex flex-col flex-1 overflow-hidden">
                  {/* Search */}
                  <div className="p-4 bg-black/20">
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                      <input 
                        type="text"
                        placeholder="Search for people..."
                        className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-3 pl-11 pr-4 text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-white/10 transition-all text-sm"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* List */}
                  <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                    {filteredProfiles.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-zinc-600 p-10 text-center">
                        <User className="w-12 h-12 mb-4 opacity-20" />
                        <p className="text-sm">No profiles found matching your search</p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {filteredProfiles.map((profile) => {
                          const isSelected = selectedUsers.includes(profile.id)
                          return (
                            <div 
                              key={profile.id}
                              onClick={() => toggleUser(profile.id)}
                              className={`flex items-center gap-4 p-3 rounded-2xl cursor-pointer transition-all duration-200 group ${isSelected ? 'bg-white/5' : 'hover:bg-white/[0.02]'}`}
                            >
                              <div className="relative">
                                <div className="w-12 h-12 rounded-full overflow-hidden bg-white/10 border border-white/5">
                                  {profile.avatar_url ? (
                                    <img src={profile.avatar_url} alt={profile.name} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-lg font-bold text-white/40 bg-white/5">
                                      {profile.name[0]}
                                    </div>
                                  )}
                                </div>
                                {isSelected && (
                                  <motion.div 
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    className="absolute -bottom-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-lg"
                                  >
                                    <Check className="w-3 h-3 text-black stroke-[3px]" />
                                  </motion.div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-white font-semibold flex items-center gap-2 truncate">
                                  {profile.name}
                                  {profile.role === 'professional' && <Shield className="w-3 h-3 text-emerald-500 fill-emerald-500/20" />}
                                </div>
                                <div className="text-zinc-500 text-xs truncate capitalize">
                                  {profile.role || 'Member'} {profile.job_role ? `• ${profile.job_role}` : ''}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* Footer Actions */}
                  <div className="p-6 border-t border-white/5 bg-gradient-to-t from-white/[0.02] to-transparent flex flex-col gap-3">
                    {error && (
                      <div className="text-red-500 text-xs font-medium text-center bg-red-500/10 py-2 rounded-lg border border-red-500/20">
                        {error}
                      </div>
                    )}
                    <button 
                      onClick={handleNext}
                      className="w-full py-4 bg-white text-black font-bold rounded-2xl hover:bg-zinc-200 transition-all transform active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3 shadow-[0_10px_30px_rgba(255,255,255,0.1)]"
                    >
                      Next
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 overflow-hidden flex flex-col">
                  <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
                    {/* Visual representation */}
                    <div className="flex flex-col items-center gap-6 py-4">
                      <div className="w-24 h-24 bg-white/5 rounded-3xl border border-white/10 flex items-center justify-center relative group cursor-pointer hover:border-white/20 transition-all overflow-hidden shadow-2xl">
                        <Users className="w-10 h-10 text-zinc-600 group-hover:text-zinc-400 transition-all" />
                        <div className="absolute inset-0 bg-white/5 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                           <Plus className="w-6 h-6 text-white mb-1" />
                           <span className="text-[10px] text-white font-bold">ADD COVER</span>
                        </div>
                      </div>
                      
                      <div className="w-full space-y-2">
                        <label className="text-xs font-bold text-zinc-500 tracking-wider uppercase ml-1">Community Name</label>
                        <input 
                          type="text"
                          placeholder="What's your community called?"
                          className="w-full bg-white/[0.03] border-b-2 border-white/10 p-3 text-xl font-bold text-white placeholder-zinc-700 focus:outline-none focus:border-white transition-all text-center"
                          autoFocus
                          value={groupName}
                          onChange={(e) => setGroupName(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                       <div className="space-y-2">
                        <label className="text-xs font-bold text-zinc-500 tracking-wider uppercase ml-1">About the community</label>
                        <textarea 
                          placeholder="Describe what happens in this community..."
                          className="w-full bg-white/[0.03] border border-white/5 rounded-2xl p-4 text-white text-sm placeholder-zinc-700 min-h-[100px] focus:outline-none focus:ring-1 focus:ring-white/20 transition-all resize-none"
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                        />
                       </div>

                       <div className="space-y-3">
                          <label className="text-xs font-bold text-zinc-500 tracking-wider uppercase ml-1">Privacy Settings</label>
                          <div className="grid grid-cols-2 gap-3">
                              <button 
                                onClick={() => setIsPublic(false)}
                                className={`flex flex-col items-start gap-3 p-4 rounded-2xl border transition-all ${!isPublic ? 'bg-white/5 border-white/20 shadow-xl' : 'bg-transparent border-white/5 opacity-50 hover:opacity-100'}`}
                              >
                                <div className={`p-2 rounded-xl ${!isPublic ? 'bg-white text-black' : 'bg-white/5 text-zinc-400'}`}>
                                  <Lock className="w-5 h-5" />
                                </div>
                                <div className="text-left">
                                  <div className="text-sm font-bold text-white">Private</div>
                                  <div className="text-[10px] text-zinc-500 leading-tight">Only members you add can see and join.</div>
                                </div>
                              </button>

                              <button 
                                onClick={() => setIsPublic(true)}
                                className={`flex flex-col items-start gap-3 p-4 rounded-2xl border transition-all ${isPublic ? 'bg-white/5 border-white/20 shadow-xl' : 'bg-transparent border-white/5 opacity-50 hover:opacity-100'}`}
                              >
                                <div className={`p-2 rounded-xl ${isPublic ? 'bg-white text-black' : 'bg-white/5 text-zinc-400'}`}>
                                  <Globe className="w-5 h-5" />
                                </div>
                                <div className="text-left">
                                  <div className="text-sm font-bold text-white">Public</div>
                                  <div className="text-[10px] text-zinc-500 leading-tight">Visible to everyone. Anyone can find it.</div>
                                </div>
                              </button>
                          </div>
                       </div>
                    </div>
                  </div>

                  {/* Final Action */}
                  <div className="p-6 border-t border-white/5 bg-gradient-to-t from-white/[0.02] to-transparent flex flex-col gap-3">
                    {error && (
                      <div className="text-red-500 text-xs font-medium text-center bg-red-500/10 py-2 rounded-lg border border-red-500/20">
                        {error}
                      </div>
                    )}
                    <button 
                      onClick={handleCreate}
                      disabled={loading || !groupName.trim()}
                      className="w-full py-4 bg-white text-black font-bold rounded-2xl hover:bg-zinc-200 transition-all transform active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3 shadow-[0_10px_40px_rgba(255,255,255,0.1)]"
                    >
                      {loading ? (
                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                          <Users className="w-5 h-5" />
                        </motion.div>
                      ) : (
                        <Check className="w-5 h-5 stroke-[3px]" />
                      )}
                      {loading ? 'Generating Community...' : 'Finalize & Launch'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
