'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { X, Camera, Edit2, Check, User, Users, ShieldCheck, LogOut, Trash2, Mail, Info, Briefcase, GraduationCap, Globe, Link, Signal, Building2, BookOpen, Rocket, Play, Plus, Trophy } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import { useIsUserOnline } from '@/hooks/useOnlineStatus'
import { useAuth } from '@/context/AuthContext'
import { useConnections } from '@/hooks/useConnections'

interface InfoSidebarProps {
  isOpen: boolean
  onClose: () => void
  type: 'profile' | 'contact' | 'group'
  data?: any
  onViewPosts?: (userId: string) => void
}

export default function InfoSidebar({ isOpen, onClose, type, data, onViewPosts }: InfoSidebarProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [name, setName] = useState(data?.name || '')
  const [bio, setBio] = useState(data?.bio || '')
  const [nickname, setNickname] = useState('')
  const [isEditingNickname, setIsEditingNickname] = useState(false)
  const [loading, setLoading] = useState(false)
  const [isTogglingAvailability, setIsTogglingAvailability] = useState(false)
  const [companyName, setCompanyName] = useState<string | null>(null)
  
  const [userPosts, setUserPosts] = useState<any[]>([])
  const [loadingPosts, setLoadingPosts] = useState(false)
  
  const [linkedin, setLinkedin] = useState(data?.linkedin || '')
  const [github, setGithub] = useState(data?.github || '')
  const [portfolio, setPortfolio] = useState(data?.portfolio || '')
  const [collegeName, setCollegeName] = useState(data?.college_name || '')
  const [course, setCourse] = useState(data?.course || '')
  const [jobRole, setJobRole] = useState(data?.job_role || '')
  const [experienceYears, setExperienceYears] = useState(data?.experience_years || '')
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState(data?.avatar_url || '')

  const { user, profile, refreshProfile, signOut } = useAuth()
  const supabase = createClient()
  
  const [challengeStats, setChallengeStats] = useState({ solved: 0, points: 0 })

  const fetchChallengeStats = async () => {
    const targetId = type === 'profile' ? user?.id : data?.id
    if (!targetId) return
    const { data: stats } = await supabase.rpc('get_user_challenge_stats', { p_user_id: targetId })
    if (stats && stats.length > 0) {
      setChallengeStats({
        solved: Number(stats[0].solved_count),
        points: Number(stats[0].total_points)
      })
    }
  }
  
  const targetUserId = type === 'profile' ? user?.id : data?.id
  const { followersCount, followingCount, isFollowing, toggleFollow, loading: connectionLoading } = useConnections(targetUserId)

  useEffect(() => {
    setName(data?.name || '')
    setBio(data?.bio || data?.description || '')
    setIsEditing(false)
    setIsEditingNickname(false)
    setCompanyName(null)

    if (type === 'contact' && data?.id) {
      const saved = localStorage.getItem(`nickname_${data.id}`)
      setNickname(saved || '')
    }

    setLinkedin(data?.linkedin || '')
    setGithub(data?.github || '')
    setPortfolio(data?.portfolio || '')
    setCollegeName(data?.college_name || '')
    setCourse(data?.course || '')
    setJobRole(data?.job_role || '')
    setExperienceYears(data?.experience_years || '')
    setCurrentAvatarUrl(data?.avatar_url || '')
    if (isOpen) {
      fetchChallengeStats()
    }

    if (data?.company_id) {
      supabase.from('companies').select('name').eq('id', data.company_id).single()
        .then(({ data: company }: { data: any }) => {
          if (company) setCompanyName(company.name)
        })
    }
  }, [data, type, isOpen])

  useEffect(() => {
    const targetUserId = type === 'profile' ? user?.id : data?.id
    if (!targetUserId) return

    // Real-time listener for challenge solutions
    const channel = supabase.channel(`solutions-sync:${targetUserId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'challenge_solutions', 
        filter: `user_id=eq.${targetUserId}` 
      }, () => {
        fetchChallengeStats()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id, data?.id, type])

  useEffect(() => {
    const targetUserId = type === 'profile' ? user?.id : data?.id
    if (!targetUserId) {
      setUserPosts([])
      setLoadingPosts(false)
      return
    }

    let isMounted = true
    setLoadingPosts(true)

    supabase.from('posts')
      .select('id, media_urls, media_types')
      .eq('user_id', targetUserId)
      .order('created_at', { ascending: false })
      .limit(9)
      .then(({ data: fetchedPosts, error }: { data: any, error: any }) => {
        if (!isMounted) return
        if (error) {
          console.error("Error fetching posts for grid:", error)
        }
        setUserPosts(fetchedPosts || [])
        setLoadingPosts(false)
      })
      .catch((e: any) => {
        if (!isMounted) return
        console.error("Exception fetching posts for grid:", e)
        setUserPosts([])
        setLoadingPosts(false)
      })

    return () => { isMounted = false }
  }, [type, user?.id, data?.id])

  const handleUpdateProfile = async () => {
    setIsEditing(false)
    setLoading(true)
    if (!user) { setLoading(false); return }
    try {
      const { error } = await supabase.from('profiles').update({ 
        name, bio, linkedin, github, portfolio,
        college_name: collegeName, course, job_role: jobRole,
        experience_years: experienceYears, avatar_url: currentAvatarUrl
      }).eq('id', user.id)
      if (error) throw error
      refreshProfile()
    } catch (error: any) {
      alert(`Error updating profile: ${error.message}`)
      setIsEditing(true)
    } finally {
      setLoading(false)
    }
  }

  const handleUploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setLoading(true)
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${Math.random()}.${fileExt}`
      const filePath = `${user.id}/${fileName}`
      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file)
      if (uploadError) throw uploadError
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath)
      setCurrentAvatarUrl(publicUrl)
      await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id)
      await supabase.auth.updateUser({ data: { avatar_url: publicUrl } })
      refreshProfile()
    } catch (error: any) {
      alert(`Error uploading avatar: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleAvailability = async (e: React.MouseEvent) => {
    e.stopPropagation()
    // Simplified checks: allow toggle if viewing own profile
    if (!user) return
    const isOwner = type === 'profile' || data?.id === user?.id
    if (!isOwner || isTogglingAvailability) return
    
    // Check if the profile is actually a professional
    const currentRole = type === 'profile' ? profile?.role : data?.role
    if (currentRole !== 'professional') return

    const actualStatus = type === 'profile' ? profile?.availability_status : data?.availability_status
    const newStatus = !actualStatus

    setIsTogglingAvailability(true)
    
    try {
      // Trigger update
      const { error } = await supabase
        .from('profiles')
        .update({ availability_status: newStatus })
        .eq('id', user.id)
      
      if (error) {
        console.error('Failed to toggle availability:', error)
        alert(`Could not change availability: ${error.message}`)
      } else {
        // Essential: call refreshProfile to update the global Auth state which triggers re-render
        await refreshProfile()
      }
    } catch (err: any) {
      console.error(err)
      alert(`Error toggling availability: ${err.message}`)
    } finally {
      setIsTogglingAvailability(false)
    }
  }

  const handleLogout = async () => {
    setLoading(true)
    if (user) {
      await supabase.from('profiles').update({ status: 'offline', last_seen: new Date().toISOString() }).eq('id', user.id)
    }
    await signOut()
    window.location.href = '/login'
  }

  const getVerificationBadge = (level: number) => {
    switch (level) {
      case 3: return { label: 'Verified Professional', color: 'text-white', border: 'bg-white/[0.06] border-white/10' }
      case 2: return { label: 'Verified Profile', color: 'text-zinc-300', border: 'bg-white/[0.04] border-white/[0.06]' }
      case 1: return { label: 'Profile Added', color: 'text-zinc-500', border: 'bg-white/[0.03] border-transparent' }
      default: return { label: 'New User', color: 'text-zinc-600', border: 'bg-white/[0.02] border-transparent' }
    }
  }

  const isContactOnline = useIsUserOnline(type === 'contact' ? data : null)

  const handleSaveNickname = () => {
    if (data?.id) {
      if (nickname.trim()) localStorage.setItem(`nickname_${data.id}`, nickname.trim())
      else localStorage.removeItem(`nickname_${data.id}`)
    }
    setIsEditingNickname(false)
  }

  const getTitle = () => {
    if (type === 'profile') return 'Profile'
    if (type === 'contact') return 'Contact Info'
    return 'Group Info'
  }

  const SkillPills = ({ skills, small }: { skills: string[]; small?: boolean }) => (
    <div className="flex flex-wrap gap-1.5">
      {skills.map((skill) => (
        <span key={skill} className={`px-2.5 py-1 rounded-full bg-white/[0.06] text-zinc-300 font-medium ${small ? 'text-[11px]' : 'text-xs'}`}>
          {skill}
        </span>
      ))}
    </div>
  )

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="absolute inset-y-0 right-0 z-40 flex w-full h-full bg-black/50 backdrop-blur-[2px]">
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="ml-auto w-full md:w-[400px] h-full bg-[#0a0a0a] border-l border-white/[0.04] flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="h-[100px] bg-[#0a0a0a] flex items-end px-6 pb-4 relative border-b border-white/[0.04]">
              <div className="absolute top-4 left-4">
                <button onClick={onClose} className="p-2 hover:bg-white/[0.06] rounded-full transition-colors text-zinc-500">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 flex justify-between items-end">
                <h2 className="text-white text-lg font-bold">{getTitle()}</h2>
                {type === 'profile' && !isEditing && (
                  <button 
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-2 px-4 py-1.5 bg-white hover:bg-zinc-200 text-black rounded-full text-[10px] font-bold uppercase tracking-widest transition-all active:scale-95 mb-0.5"
                  >
                    <Edit2 className="w-3 h-3" />
                    Edit
                  </button>
                )}
                {type === 'profile' && isEditing && (
                  <button 
                    onClick={() => setIsEditing(false)}
                    className="flex items-center gap-2 px-4 py-1.5 bg-white/[0.06] hover:bg-white/[0.1] text-white rounded-full text-[10px] font-bold uppercase tracking-widest transition-all active:scale-95 mb-0.5"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 pb-12 space-y-8">
              {/* Avatar */}
              <div className="flex flex-col items-center gap-4">
                <div className="relative group cursor-pointer" onClick={() => type === 'profile' && document.getElementById('avatar-upload')?.click()}>
                  <div className="w-40 h-40 rounded-full bg-white/[0.04] flex items-center justify-center overflow-hidden border-2 border-white/[0.06] group-hover:scale-[1.02] transition-transform relative">
                    {currentAvatarUrl ? (
                      <img src={currentAvatarUrl} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-20 h-20 text-zinc-700" />
                    )}
                    {loading && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <div className="w-8 h-8 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    )}
                  </div>
                  {type === 'profile' && (
                    <>
                      <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Camera className="w-8 h-8 text-white" />
                      </div>
                      <input type="file" id="avatar-upload" className="hidden" accept="image/*" onChange={handleUploadAvatar} />
                    </>
                  )}
                  {type === 'contact' && isContactOnline && data?.availability_status !== false && (
                    <div className="absolute bottom-2 right-2 w-5 h-5 bg-white rounded-full border-[3px] border-[#0a0a0a]" />
                  )}
                </div>

                {type === 'contact' && (
                  <div className="text-center">
                    <h3 className="text-white text-2xl font-bold">{nickname || data?.name || 'Unknown'}</h3>
                    <div className="flex items-center justify-center gap-1.5 mt-0.5">
                      {isContactOnline ? (
                        <span className="text-zinc-400 text-sm font-medium">online</span>
                      ) : (
                        <span className="text-zinc-600 text-sm">offline</span>
                      )}
                      <span className="text-zinc-800">·</span>
                      <span className="text-white font-bold text-sm tracking-tight">{followersCount}</span>
                      <span className="text-zinc-500 text-[11px] font-bold uppercase tracking-wider">Connections</span>
                      <span className="text-zinc-800">·</span>
                      <div className="flex items-center gap-1 px-2 py-0.5 bg-amber-400/10 rounded-full border border-amber-400/20">
                        <Trophy className="w-2.5 h-2.5 text-amber-500" />
                        <span className="text-amber-500 font-bold text-[10px] uppercase tracking-tighter">{challengeStats.solved} Solved</span>
                      </div>
                    </div>

                    {/* Contact Connect Button */}
                    {data?.id !== user?.id && (
                      <div className="flex justify-center gap-2 mt-4">
                        <button 
                          onClick={toggleFollow}
                          disabled={connectionLoading}
                          className={`flex items-center justify-center gap-2 px-6 py-2 rounded-xl font-bold text-xs uppercase tracking-widest transition-all active:scale-95 ${isFollowing ? 'bg-white/[0.06] text-white border border-white/10 hover:bg-white/10' : 'bg-white text-black hover:bg-zinc-200'}`}
                        >
                          {isFollowing ? (
                            <>
                              <Check className="w-4 h-4" />
                              Connected
                            </>
                          ) : (
                            <>
                              <Plus className="w-4 h-4" />
                              Connect
                            </>
                          )}
                        </button>
                        <button 
                          onClick={() => onViewPosts?.(data?.id)}
                          className="p-2.5 bg-white/[0.06] hover:bg-white/10 border border-white/10 rounded-xl text-white transition-all active:scale-95"
                          title="View Posts"
                        >
                          <Rocket className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Info Rows */}
              <div className="space-y-6">

                {/* ===== PROFILE MODE ===== */}
                {type === 'profile' && (
                  <>
                    {data?.verification_level !== undefined && (
                      <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${getVerificationBadge(data.verification_level).border}`}>
                        <ShieldCheck className={`w-4 h-4 ${getVerificationBadge(data.verification_level).color}`} />
                        <span className={`text-sm font-medium ${getVerificationBadge(data.verification_level).color}`}>
                          {getVerificationBadge(data.verification_level).label}
                        </span>
                      </div>
                    )}

                    {(type === 'profile' || data?.id === user?.id) && (type === 'profile' ? profile?.role : data?.role) === 'professional' && (
                      <div 
                        onClick={handleToggleAvailability}
                        className={`flex items-center justify-between bg-white/[0.03] rounded-xl p-4 cursor-pointer transition-all hover:bg-white/[0.06] ${isTogglingAvailability ? 'opacity-50 pointer-events-none' : ''}`}
                      >
                        <div className="flex items-center gap-3">
                          <Signal className={`w-4 h-4 ${(type === 'profile' ? profile?.availability_status : data?.availability_status) ? 'text-white' : 'text-zinc-600'}`} />
                          <div>
                            <p className="text-white font-medium text-sm">Available for messages</p>
                            <p className="text-zinc-600 text-xs">{(type === 'profile' ? profile?.availability_status : data?.availability_status) ? 'Visible in search' : 'Hidden'}</p>
                          </div>
                        </div>
                        <button
                          disabled={isTogglingAvailability}
                          className={`relative w-11 h-6 rounded-full transition-all duration-300 ${(type === 'profile' ? profile?.availability_status : data?.availability_status) ? 'bg-white' : 'bg-white/[0.1]'} disabled:opacity-50`}
                        >
                          <div className={`absolute top-1 w-4 h-4 rounded-full transition-all duration-300 ${(type === 'profile' ? profile?.availability_status : data?.availability_status) ? 'left-6 bg-black' : 'left-1 bg-zinc-500'}`} />
                        </button>
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="text-zinc-500 text-xs font-bold uppercase tracking-wider">Your Name</label>
                      <div className="flex items-center justify-between group">
                        {isEditing ? (
                          <input type="text" className="w-full bg-transparent border-b border-white/20 py-1 text-white text-lg focus:ring-0 outline-none focus:border-white/40" value={name} onChange={(e) => setName(e.target.value)} />
                        ) : (
                          <div className="flex flex-col">
                            <span className="text-white text-lg font-medium">{name || 'Add a name'}</span>
                            <div className="flex items-center gap-4 mt-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-white font-bold text-sm">{followersCount}</span>
                                <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-tight">Connections</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-white font-bold text-sm">{followingCount}</span>
                                <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-tight">Following</span>
                              </div>
                              <div className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-400/10 rounded-full border border-amber-400/20">
                                <Trophy className="w-2.5 h-2.5 text-amber-500" />
                                <span className="text-amber-500 font-bold text-[10px] uppercase tracking-tighter">{challengeStats.solved} Solved</span>
                              </div>
                            </div>
                          </div>
                        )}
                        {type === 'profile' && !isEditing && (
                          <button onClick={() => setIsEditing(true)} className="p-2 text-zinc-500 hover:text-white transition-colors">
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {data?.role === 'student' && (
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <label className="text-zinc-500 text-xs font-bold uppercase tracking-wider">College</label>
                          {isEditing ? (
                            <input type="text" className="w-full bg-transparent border-b border-white/20 py-1 text-white text-sm focus:ring-0 outline-none" value={collegeName} onChange={(e) => setCollegeName(e.target.value)} />
                          ) : (
                            <div className="flex items-center gap-2">
                              <GraduationCap className="w-4 h-4 text-zinc-600" />
                              <p className="text-zinc-300 font-medium">{collegeName || 'Add college'}</p>
                            </div>
                          )}
                        </div>
                        <div className="space-y-1">
                          <label className="text-zinc-500 text-xs font-bold uppercase tracking-wider">Course</label>
                          {isEditing ? (
                            <input type="text" className="w-full bg-transparent border-b border-white/20 py-1 text-white text-sm focus:ring-0 outline-none" value={course} onChange={(e) => setCourse(e.target.value)} />
                          ) : (
                            <div className="flex items-center gap-2">
                              <BookOpen className="w-4 h-4 text-zinc-600" />
                              <p className="text-zinc-300 font-medium">{course || 'Add course'}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {data?.role === 'professional' && (
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <label className="text-zinc-500 text-xs font-bold uppercase tracking-wider">Job Role</label>
                          {isEditing ? (
                            <div className="flex gap-2">
                              <input type="text" className="flex-1 bg-transparent border-b border-white/20 py-1 text-white text-sm focus:ring-0 outline-none" value={jobRole} onChange={(e) => setJobRole(e.target.value)} placeholder="Job Role" />
                               <input type="text" className="w-20 bg-transparent border-b border-white/20 py-1 text-white text-sm focus:ring-0 outline-none" value={experienceYears} onChange={(e) => setExperienceYears(e.target.value)} placeholder="Years" />
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Briefcase className="w-4 h-4 text-zinc-600" />
                              <p className="text-zinc-300 font-medium">{jobRole}{experienceYears ? ` · ${experienceYears} yrs` : 'Add role'}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {data?.skills?.length > 0 && (
                      <div className="space-y-2">
                        <label className="text-zinc-500 text-xs font-bold uppercase tracking-wider">Skills</label>
                        <SkillPills skills={data.skills} />
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="text-zinc-500 text-xs font-bold uppercase tracking-wider">About</label>
                      <div className="flex items-start justify-between group">
                        {isEditing ? (
                          <textarea className="w-full bg-transparent border-b border-white/20 py-1 text-white focus:ring-0 outline-none min-h-[80px]" value={bio} onChange={(e) => setBio(e.target.value)} />
                        ) : (
                          <p className="text-zinc-500 leading-relaxed">{bio || 'Hey there! I am using Nexus.'}</p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <label className="text-zinc-500 text-xs font-bold uppercase tracking-wider">Links</label>
                      {isEditing ? (
                        <div className="space-y-3 pt-1">
                          <div className="flex items-center gap-3 bg-white/[0.03] rounded-xl p-3">
                            <Link className="w-4 h-4 text-zinc-600" />
                            <input type="text" placeholder="LinkedIn URL" className="bg-transparent border-none text-sm text-white w-full p-0 focus:ring-0 outline-none placeholder-zinc-700" value={linkedin} onChange={(e) => setLinkedin(e.target.value)} />
                          </div>
                          <div className="flex items-center gap-3 bg-white/[0.03] rounded-xl p-3">
                            <Globe className="w-4 h-4 text-zinc-600" />
                            <input type="text" placeholder="Github Username" className="bg-transparent border-none text-sm text-white w-full p-0 focus:ring-0 outline-none placeholder-zinc-700" value={github} onChange={(e) => setGithub(e.target.value)} />
                          </div>
                          <div className="flex items-center gap-3 bg-white/[0.03] rounded-xl p-3">
                            <Globe className="w-4 h-4 text-zinc-600" />
                            <input type="text" placeholder="Portfolio Link" className="bg-transparent border-none text-sm text-white w-full p-0 focus:ring-0 outline-none placeholder-zinc-700" value={portfolio} onChange={(e) => setPortfolio(e.target.value)} />
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2 pt-1">
                          {linkedin && (
                            <a href={linkedin} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-3 bg-white/[0.03] hover:bg-white/[0.06] rounded-xl transition-all border border-white/[0.04]">
                              <div className="flex items-center gap-3"><Link className="w-4 h-4 text-zinc-400" /><span className="text-white text-[13px] font-medium">LinkedIn</span></div>
                              <Globe className="w-3.5 h-3.5 text-zinc-600" />
                            </a>
                          )}
                          {github && (
                            <a href={`https://github.com/${github}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-3 bg-white/[0.03] hover:bg-white/[0.06] rounded-xl transition-all border border-white/[0.04]">
                              <div className="flex items-center gap-3"><Globe className="w-4 h-4 text-zinc-400" /><span className="text-white text-[13px] font-medium">GitHub</span></div>
                              <Globe className="w-3.5 h-3.5 text-zinc-600" />
                            </a>
                          )}
                          {portfolio && (
                            <a href={portfolio} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-3 bg-white/[0.03] hover:bg-white/[0.06] rounded-xl transition-all border border-white/[0.04]">
                              <div className="flex items-center gap-3"><Link className="w-4 h-4 text-zinc-400" /><span className="text-white text-[13px] font-medium">Portfolio</span></div>
                              <Globe className="w-3.5 h-3.5 text-zinc-600" />
                            </a>
                          )}
                          {!linkedin && !github && !portfolio && <p className="text-zinc-600 text-sm">No links added yet.</p>}
                        </div>
                      )}
                    </div>

                    {isEditing && (
                      <div className="flex justify-end gap-3 pt-4">
                        <button onClick={() => setIsEditing(false)} disabled={loading} className="px-4 py-2 text-zinc-500 font-bold hover:bg-white/[0.04] rounded-lg text-sm">Cancel</button>
                        <button onClick={handleUpdateProfile} disabled={loading} className="px-6 py-2 bg-white text-black font-bold rounded-lg hover:bg-zinc-200 transition-all text-sm">
                          {loading ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    )}
                  </>
                )}

                {/* ===== CONTACT MODE ===== */}
                {type === 'contact' && (
                  <>
                    <div className="bg-white/[0.03] rounded-xl p-4 space-y-2">
                      <label className="text-zinc-500 text-xs font-bold uppercase tracking-wider">Nickname (only visible to you)</label>
                      <div className="flex items-center justify-between gap-2">
                        {isEditingNickname ? (
                          <div className="flex items-center gap-2 w-full">
                            <input type="text" className="flex-1 bg-transparent border-b border-white/20 py-1 text-white text-lg focus:ring-0 outline-none" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder={data?.name || 'Set a nickname...'} autoFocus />
                            <button onClick={handleSaveNickname} className="p-2 text-white hover:text-zinc-300">
                              <Check className="w-5 h-5" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <span className="text-white text-lg">{nickname || 'Not set'}</span>
                            <button onClick={() => setIsEditingNickname(true)} className="p-2 text-zinc-600 hover:text-white transition-colors">
                              <Edit2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {data?.id && (
                      <div className="space-y-3 pt-2">
                        <label className="text-zinc-500 text-xs font-bold uppercase tracking-wider">Activity</label>
                        <button 
                          onClick={() => onViewPosts?.(data.id)}
                          className="w-full flex items-center justify-between p-3.5 bg-white/[0.03] hover:bg-white/[0.06] rounded-xl transition-all group border border-white/[0.04]"
                        >
                          <div className="flex items-center gap-3">
                            <Rocket className="w-5 h-5 text-zinc-400 group-hover:scale-110 transition-transform" />
                            <div className="text-left">
                              <span className="text-white text-sm font-bold block">View Achievements</span>
                              <span className="text-zinc-600 text-[11px]">See all projects & workshops</span>
                            </div>
                          </div>
                        </button>
                      </div>
                    )}

                    {data?.verification_level !== undefined && (
                      <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${getVerificationBadge(data.verification_level).border}`}>
                        <ShieldCheck className={`w-4 h-4 ${getVerificationBadge(data.verification_level).color}`} />
                        <span className={`text-xs font-medium ${getVerificationBadge(data.verification_level).color}`}>
                          {getVerificationBadge(data.verification_level).label}
                        </span>
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="text-zinc-500 text-xs font-bold uppercase tracking-wider">Name</label>
                      <p className="text-white text-lg font-medium">{data?.name || 'Unknown'}</p>
                    </div>

                    {data?.role === 'student' && data?.college_name && (
                      <div className="space-y-1">
                        <label className="text-zinc-500 text-xs font-bold uppercase tracking-wider">College</label>
                        <div className="flex items-center gap-2"><GraduationCap className="w-4 h-4 text-zinc-600" /><p className="text-zinc-400">{data.college_name}</p></div>
                      </div>
                    )}
                    {data?.role === 'student' && data?.course && (
                      <div className="space-y-1">
                        <label className="text-zinc-500 text-xs font-bold uppercase tracking-wider">Course</label>
                        <div className="flex items-center gap-2"><BookOpen className="w-4 h-4 text-zinc-600" /><p className="text-zinc-400">{data.course}</p></div>
                      </div>
                    )}
                    {data?.role === 'professional' && companyName && (
                      <div className="space-y-1">
                        <label className="text-zinc-500 text-xs font-bold uppercase tracking-wider">Company</label>
                        <div className="flex items-center gap-2"><Building2 className="w-4 h-4 text-zinc-600" /><p className="text-zinc-400">{companyName}</p></div>
                      </div>
                    )}
                    {data?.role === 'professional' && data?.job_role && (
                      <div className="space-y-1">
                        <label className="text-zinc-500 text-xs font-bold uppercase tracking-wider">Role</label>
                        <div className="flex items-center gap-2"><Briefcase className="w-4 h-4 text-zinc-600" /><p className="text-zinc-400">{data.job_role}{data.experience_years ? ` · ${data.experience_years} yrs exp` : ''}</p></div>
                      </div>
                    )}
                    {data?.skills?.length > 0 && (
                      <div className="space-y-2">
                        <label className="text-zinc-500 text-xs font-bold uppercase tracking-wider">Skills</label>
                        <SkillPills skills={data.skills} small />
                      </div>
                    )}
                    <div className="space-y-2">
                      <label className="text-zinc-500 text-xs font-bold uppercase tracking-wider">Email</label>
                      <div className="flex items-center gap-3"><Mail className="w-4 h-4 text-zinc-600" /><p className="text-zinc-400">{data?.email || 'Not available'}</p></div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-zinc-500 text-xs font-bold uppercase tracking-wider">About</label>
                      <div className="flex items-start gap-3"><Info className="w-4 h-4 text-zinc-600 shrink-0 mt-0.5" /><p className="text-zinc-500 text-sm leading-relaxed">{data?.bio || 'Hey there! I am using Nexus.'}</p></div>
                    </div>
                    {(data?.linkedin || data?.github || data?.portfolio) && (
                      <div className="space-y-3 pt-1">
                        <label className="text-zinc-500 text-xs font-bold uppercase tracking-wider">Links</label>
                        <div className="flex flex-col gap-2">
                          {data.linkedin && (
                            <a href={data.linkedin} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-3 bg-white/[0.03] hover:bg-white/[0.06] rounded-xl transition-all border border-white/[0.04]">
                              <div className="flex items-center gap-2.5"><Link className="w-4 h-4 text-zinc-400" /><span className="text-white text-xs font-medium">LinkedIn</span></div>
                              <Globe className="w-3.5 h-3.5 text-zinc-600" />
                            </a>
                          )}
                          {data.github && (
                            <a href={`https://github.com/${data.github}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-3 bg-white/[0.03] hover:bg-white/[0.06] rounded-xl transition-all border border-white/[0.04]">
                              <div className="flex items-center gap-2.5"><Globe className="w-4 h-4 text-zinc-400" /><span className="text-white text-xs font-medium">GitHub</span></div>
                              <Globe className="w-3.5 h-3.5 text-zinc-600" />
                            </a>
                          )}
                          {data.portfolio && (
                            <a href={data.portfolio} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-3 bg-white/[0.03] hover:bg-white/[0.06] rounded-xl transition-all border border-white/[0.04]">
                              <div className="flex items-center gap-2.5"><Link className="w-4 h-4 text-zinc-400" /><span className="text-white text-xs font-medium">Portfolio</span></div>
                              <Globe className="w-3.5 h-3.5 text-zinc-600" />
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* ===== INSTAGRAM STYLE POST GRID (Both Profile & Contact) ===== */}
                {(type === 'profile' || type === 'contact') && (
                  <div className="space-y-3 pt-6 border-t border-white/[0.04]">
                    <div className="flex items-center justify-between">
                      <label className="text-white text-sm font-bold uppercase tracking-wider">Posts</label>
                      <button onClick={() => onViewPosts?.(type === 'profile' ? user?.id! : data?.id)} className="text-zinc-500 text-xs font-bold hover:text-white transition-colors">
                        View Feed
                      </button>
                    </div>
                    
                    {loadingPosts ? (
                       <div className="grid grid-cols-3 gap-1 animate-pulse">
                         {[1,2,3].map(i => <div key={i} className="aspect-square bg-white/[0.03]"></div>)}
                       </div>
                    ) : userPosts.length > 0 ? (
                      <div className="grid grid-cols-3 gap-1">
                        {userPosts.map(post => {
                          const hasMedia = post.media_urls && post.media_urls.length > 0;
                          return (
                            <div 
                              key={post.id} 
                              className="aspect-square bg-white/[0.02] relative cursor-pointer group overflow-hidden" 
                              onClick={() => onViewPosts?.(type === 'profile' ? user?.id! : data?.id)}
                            >
                               {hasMedia ? (
                                  post.media_types?.[0] === 'video' ? (
                                     <div className="w-full h-full relative">
                                        <video src={post.media_urls[0]} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                                        <Play className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 text-white drop-shadow-xl" />
                                     </div>
                                  ) : (
                                     <img src={post.media_urls[0]} className="w-full h-full object-cover opacity-80 group-hover:scale-105 group-hover:opacity-100 transition-all duration-500" />
                                  )
                               ) : (
                                  <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-zinc-800 to-black group-hover:opacity-80 transition-opacity">
                                    <Rocket className="w-5 h-5 text-zinc-500 mb-1" />
                                    <span className="text-[8px] uppercase font-bold text-zinc-600 tracking-wider">Text Post</span>
                                  </div>
                               )}
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-6 bg-white/[0.02] rounded-xl border border-white/[0.02]">
                         <Rocket className="w-6 h-6 text-zinc-600 mb-2" />
                         <span className="text-xs text-zinc-500 font-medium">No posts shared yet</span>
                      </div>
                    )}
                  </div>
                )}

                {/* ===== GROUP MODE ===== */}
                {type === 'group' && (
                  <>
                    <div className="space-y-2">
                      <label className="text-zinc-500 text-xs font-bold uppercase tracking-wider">Group Name</label>
                      <span className="text-white text-lg font-medium block">{data?.name || 'Unnamed Group'}</span>
                    </div>
                    <div className="space-y-4 pt-4 border-t border-white/[0.04]">
                      <div className="flex items-center justify-between text-zinc-500">
                        <span className="text-sm font-medium">{data?.members?.length || 0} Members</span>
                        <Users className="w-5 h-5" />
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Danger Zone */}
              <div className="pt-8 pb-40 space-y-4">
                {type === 'profile' && (
                  <button 
                    onClick={handleLogout}
                    disabled={loading}
                    className="w-full flex items-center gap-4 p-4 text-red-400 hover:bg-red-500/[0.05] rounded-xl transition-all font-medium border border-red-500/10 group disabled:opacity-50"
                  >
                    <LogOut className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    <span className="text-sm">{loading ? 'Logging out...' : 'Logout Account'}</span>
                  </button>
                )}
                {type === 'contact' && (
                  <button className="w-full flex items-center gap-4 p-4 text-red-400 hover:bg-red-500/[0.05] rounded-xl transition-all font-medium border border-red-500/10 group">
                    <Trash2 className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    <span className="text-sm">Delete Chat</span>
                  </button>
                )}
                {type === 'group' && (
                  <button className="w-full flex items-center gap-4 p-4 text-red-400 hover:bg-red-500/[0.05] rounded-xl transition-all font-medium border border-red-500/10 group">
                    <Trash2 className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    <span className="text-sm">Delete Group</span>
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
