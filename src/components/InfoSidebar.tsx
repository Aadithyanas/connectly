'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { X, Camera, Edit2, Check, User, Users, ShieldCheck, LogOut, Trash2, Mail, Info, Briefcase, GraduationCap, Globe, Link, Signal, Building2, BookOpen, Rocket } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import { useIsUserOnline } from '@/hooks/useOnlineStatus'
import { useAuth } from '@/context/AuthContext'

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
  
  // New States for Editing
  const [linkedin, setLinkedin] = useState(data?.linkedin || '')
  const [github, setGithub] = useState(data?.github || '')
  const [portfolio, setPortfolio] = useState(data?.portfolio || '')
  const [collegeName, setCollegeName] = useState(data?.college_name || '')
  const [course, setCourse] = useState(data?.course || '')
  const [jobRole, setJobRole] = useState(data?.job_role || '')
  const [experienceYears, setExperienceYears] = useState(data?.experience_years || '')
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState(data?.avatar_url || '')

  const { user, profile, refreshProfile } = useAuth()
  const supabase = createClient()

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

    // Fetch company name whenever a professional's card opens
    if (data?.company_id) {
      supabase
        .from('companies')
        .select('name')
        .eq('id', data.company_id)
        .single()
        .then(({ data: company }: { data: any }) => {
          if (company) setCompanyName(company.name)
        })
    }
  }, [data, type])

  const handleUpdateProfile = async () => {
    // Optimistic Update: Close editor immediately to feel fast
    setIsEditing(false)
    setLoading(true)
    
    if (!user) {
      setLoading(false)
      return
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          name, 
          bio,
          linkedin,
          github,
          portfolio,
          college_name: collegeName,
          course,
          job_role: jobRole,
          experience_years: experienceYears,
          avatar_url: currentAvatarUrl
        })
        .eq('id', user.id)

      if (error) throw error
      
      // Refresh in background
      refreshProfile()
    } catch (error: any) {
      alert(`Error updating profile: ${error.message}`)
      setIsEditing(true) // Re-open if failed
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
      const filePath = `${user.id}/${fileName}` // Corrected for RLS: folder must be User ID

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      setCurrentAvatarUrl(publicUrl)
      
      // Auto-save to profile
      await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id)

      // ALSO update Auth metadata so the sidebar refreshes instantly
      await supabase.auth.updateUser({
        data: { avatar_url: publicUrl }
      })
        
      refreshProfile()
    } catch (error: any) {
      alert(`Error uploading avatar: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleAvailability = async () => {
    if (type !== 'profile' || !user) return
    setIsTogglingAvailability(true)
    const currentStatus = type === 'profile' ? profile?.availability_status : data?.availability_status
    const newStatus = !currentStatus
    const { error } = await supabase
      .from('profiles')
      .update({ availability_status: newStatus })
      .eq('id', user.id)
    if (!error) await refreshProfile()
    setIsTogglingAvailability(false)
  }

  // FIX: switch-case evaluates in order — level 3 is now checked first, so it's reachable
  const getVerificationBadge = (level: number) => {
    switch (level) {
      case 3: return { label: 'Verified Professional', color: 'text-[#3b82f6]', border: 'bg-[#3b82f6]/10 border-[#3b82f6]/30' }
      case 2: return { label: 'Verified Profile',      color: 'text-[#00a884]', border: 'bg-[#00a884]/10 border-[#00a884]/30' }
      case 1: return { label: 'Profile Added',         color: 'text-[#8696a0]', border: 'bg-[#202c33] border-transparent' }
      default: return { label: 'New User',             color: 'text-[#667781]', border: 'bg-[#202c33] border-transparent' }
    }
  }

  const isContactOnline = useIsUserOnline(type === 'contact' ? data : null)

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

  const SkillPills = ({ skills, small }: { skills: string[]; small?: boolean }) => (
    <div className="flex flex-wrap gap-1.5">
      {skills.map((skill) => (
        <span
          key={skill}
          className={`px-2.5 py-1 rounded-full bg-[#00a884]/10 text-[#00a884] font-medium ${small ? 'text-[11px]' : 'text-xs'}`}
        >
          {skill}
        </span>
      ))}
    </div>
  )

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="absolute inset-y-0 right-0 z-40 flex w-full h-full bg-black/40 backdrop-blur-[2px]">
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="ml-auto w-full md:max-w-[400px] h-full bg-[#111b21] border-l border-[#2a3942] flex flex-col shadow-2xl shadow-black/80"
          >
            {/* Header */}
            <div className="h-[120px] bg-[#202c33] flex items-end px-6 pb-4 relative overflow-hidden">
              <div className="absolute top-4 left-4">
                <button onClick={onClose} className="p-2 hover:bg-[#374248] rounded-full transition-colors text-[#8696a0]">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="flex-1 flex justify-between items-end">
                <h2 className="text-[#e9edef] text-xl font-bold">{getTitle()}</h2>
                {type === 'profile' && !isEditing && (
                  <button 
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-2 px-4 py-1.5 bg-[#00a884] hover:bg-[#00c99e] text-[#111b21] rounded-full text-xs font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 mb-0.5"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    Edit Profile
                  </button>
                )}
                {type === 'profile' && isEditing && (
                  <button 
                    onClick={() => setIsEditing(false)}
                    className="flex items-center gap-2 px-4 py-1.5 bg-[#374248] hover:bg-[#4a555c] text-[#e9edef] rounded-full text-xs font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 mb-0.5"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8 bg-[#111b21]">
              {/* Avatar */}
              <div className="flex flex-col items-center gap-4">
                <div className="relative group cursor-pointer" onClick={() => type === 'profile' && document.getElementById('avatar-upload')?.click()}>
                  <div className="w-48 h-48 rounded-full bg-[#374248] flex items-center justify-center overflow-hidden border-4 border-[#111b21] shadow-xl group-hover:scale-[1.02] transition-transform relative">
                    {currentAvatarUrl ? (
                      <img src={currentAvatarUrl} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-24 h-24 text-[#8696a0]" />
                    )}
                    {loading && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <div className="w-8 h-8 border-4 border-[#00a884] border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    )}
                  </div>
                  {type === 'profile' && (
                    <>
                      <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Camera className="w-10 h-10 text-white" />
                      </div>
                      <input 
                        type="file" 
                        id="avatar-upload" 
                        className="hidden" 
                        accept="image/*"
                        onChange={handleUploadAvatar}
                      />
                    </>
                  )}
                  {type === 'contact' && isContactOnline && data?.availability_status !== false && (
                    <div className="absolute bottom-2 right-2 w-5 h-5 bg-[#25d366] rounded-full border-[3px] border-[#111b21] shadow-[0_0_8px_rgba(37,211,102,0.6)]" />
                  )}
                </div>

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

                {/* ===== PROFILE MODE ===== */}
                {type === 'profile' && (
                  <>
                    {/* Verification Badge — uses .border from switch so level 3 is correctly styled */}
                    {data?.verification_level !== undefined && (
                      <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${getVerificationBadge(data.verification_level).border}`}>
                        <ShieldCheck className={`w-5 h-5 ${getVerificationBadge(data.verification_level).color}`} />
                        <span className={`text-sm font-medium ${getVerificationBadge(data.verification_level).color}`}>
                          {getVerificationBadge(data.verification_level).label}
                        </span>
                      </div>
                    )}

                    {/* Availability Toggle (professionals only) */}
                    {(type === 'profile' || data?.id === user?.id) && data?.role === 'professional' && (
                      <div className="flex items-center justify-between bg-[#202c33] rounded-xl p-4">
                        <div className="flex items-center gap-3">
                          <Signal className={`w-5 h-5 ${(type === 'profile' ? profile?.availability_status : data?.availability_status) ? 'text-[#00a884]' : 'text-[#8696a0]'}`} />
                          <div>
                            <p className="text-[#e9edef] font-medium text-sm">Available for messages</p>
                            <p className="text-[#8696a0] text-xs">{(type === 'profile' ? profile?.availability_status : data?.availability_status) ? 'Visible in search' : 'Hidden from search'}</p>
                          </div>
                        </div>
                        <button
                          onClick={handleToggleAvailability}
                          disabled={isTogglingAvailability}
                          className={`relative w-12 h-6 rounded-full transition-all duration-300 ${(type === 'profile' ? profile?.availability_status : data?.availability_status) ? 'bg-[#00a884]' : 'bg-[#374248]'} disabled:opacity-50`}
                        >
                          <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-300 ${(type === 'profile' ? profile?.availability_status : data?.availability_status) ? 'left-7' : 'left-1'}`} />
                        </button>
                      </div>
                    )}

                    {/* Name */}
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
                        {type === 'profile' && !isEditing && (
                          <button onClick={() => setIsEditing(true)} className="p-2 text-[#00a884] hover:text-[#e9edef] transition-colors">
                            <Edit2 className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Student: college + course */}
                    {data?.role === 'student' && (
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <label className="text-[#00a884] text-sm font-medium uppercase tracking-wider">College</label>
                          {isEditing ? (
                            <input
                              type="text"
                              className="w-full bg-transparent border-b-2 border-[#00a884] py-1 text-[#e9edef] text-sm focus:ring-0 outline-none"
                              value={collegeName}
                              onChange={(e) => setCollegeName(e.target.value)}
                            />
                          ) : (
                            <div className="flex items-center gap-2">
                              <GraduationCap className="w-4 h-4 text-[#8696a0]" />
                              <p className="text-[#e9edef] font-medium">{collegeName || 'Add college'}</p>
                            </div>
                          )}
                        </div>
                        <div className="space-y-1">
                          <label className="text-[#00a884] text-sm font-medium uppercase tracking-wider">Course</label>
                          {isEditing ? (
                            <input
                              type="text"
                              className="w-full bg-transparent border-b-2 border-[#00a884] py-1 text-[#e9edef] text-sm focus:ring-0 outline-none"
                              value={course}
                              onChange={(e) => setCourse(e.target.value)}
                            />
                          ) : (
                            <div className="flex items-center gap-2">
                              <BookOpen className="w-4 h-4 text-[#8696a0]" />
                              <p className="text-[#e9edef] font-medium">{course || 'Add course'}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Professional: company + job role */}
                    {data?.role === 'professional' && (
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <label className="text-[#00a884] text-sm font-medium uppercase tracking-wider">Job Role</label>
                          {isEditing ? (
                            <div className="flex gap-2">
                              <input
                                type="text"
                                className="flex-1 bg-transparent border-b-2 border-[#00a884] py-1 text-[#e9edef] text-sm focus:ring-0 outline-none"
                                value={jobRole}
                                onChange={(e) => setJobRole(e.target.value)}
                                placeholder="Job Role"
                              />
                               <input
                                type="text"
                                className="w-20 bg-transparent border-b-2 border-[#00a884] py-1 text-[#e9edef] text-sm focus:ring-0 outline-none"
                                value={experienceYears}
                                onChange={(e) => setExperienceYears(e.target.value)}
                                placeholder="Years"
                              />
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Briefcase className="w-4 h-4 text-[#8696a0]" />
                              <p className="text-[#e9edef] font-medium">{jobRole}{experienceYears ? ` · ${experienceYears} yrs` : 'Add role'}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Skills */}
                    {data?.skills?.length > 0 && (
                      <div className="space-y-2">
                        <label className="text-[#00a884] text-sm font-medium uppercase tracking-wider">Skills</label>
                        <SkillPills skills={data.skills} />
                      </div>
                    )}

                    {/* About */}
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

                    {/* Social Links */}
                    <div className="space-y-4">
                      <label className="text-[#00a884] text-sm font-medium uppercase tracking-wider">Professional Links</label>
                      {isEditing ? (
                        <div className="space-y-4 pt-1">
                          <div className="flex items-center gap-3 bg-[#202c33] rounded-xl p-3">
                            <Link className="w-5 h-5 text-[#8696a0]" />
                            <input 
                              type="text" 
                              placeholder="LinkedIn URL" 
                              className="bg-transparent border-none text-sm text-[#e9edef] w-full p-0 focus:ring-0" 
                              value={linkedin}
                              onChange={(e) => setLinkedin(e.target.value)}
                            />
                          </div>
                          <div className="flex items-center gap-3 bg-[#202c33] rounded-xl p-3">
                            <Globe className="w-5 h-5 text-[#8696a0]" />
                            <input 
                              type="text" 
                              placeholder="Github Username" 
                              className="bg-transparent border-none text-sm text-[#e9edef] w-full p-0 focus:ring-0" 
                              value={github}
                              onChange={(e) => setGithub(e.target.value)}
                            />
                          </div>
                          <div className="flex items-center gap-3 bg-[#202c33] rounded-xl p-3">
                            <Globe className="w-5 h-5 text-[#8696a0]" />
                            <input 
                              type="text" 
                              placeholder="Portfolio Link" 
                              className="bg-transparent border-none text-sm text-[#e9edef] w-full p-0 focus:ring-0" 
                              value={portfolio}
                              onChange={(e) => setPortfolio(e.target.value)}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-3 pt-1">
                          {linkedin && (
                            <a href={linkedin} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-3 bg-[#202c33] hover:bg-[#374248] rounded-xl transition-all border border-white/5">
                              <div className="flex items-center gap-3"><Link className="w-5 h-5 text-[#00a884]" /><span className="text-[#e9edef] text-[13.5px] font-medium">LinkedIn Profile</span></div>
                              <Globe className="w-4 h-4 text-[#8696a0]" />
                            </a>
                          )}
                          {github && (
                            <a href={`https://github.com/${github}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-3 bg-[#202c33] hover:bg-[#374248] rounded-xl transition-all border border-white/5">
                              <div className="flex items-center gap-3"><Globe className="w-5 h-5 text-[#e9edef]" /><span className="text-[#e9edef] text-[13.5px] font-medium">GitHub Repository</span></div>
                              <Globe className="w-4 h-4 text-[#8696a0]" />
                            </a>
                          )}
                          {portfolio && (
                            <a href={portfolio} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-3 bg-[#202c33] hover:bg-[#374248] rounded-xl transition-all border border-white/5">
                              <div className="flex items-center gap-3"><Link className="w-5 h-5 text-[#3b82f6]" /><span className="text-[#e9edef] text-[13.5px] font-medium">Personal Portfolio</span></div>
                              <Globe className="w-4 h-4 text-[#8696a0]" />
                            </a>
                          )}
                          {!linkedin && !github && !portfolio && <p className="text-[#8696a0] text-sm italic">No social links added yet.</p>}
                        </div>
                      )}
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

                {/* ===== CONTACT MODE ===== */}
                {type === 'contact' && (
                  <>
                    {/* Nickname */}
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

                    {/* Activity Section */}
                    {data?.id && (
                      <div className="space-y-3 pt-2">
                        <label className="text-[#00a884] text-xs font-medium uppercase tracking-wider">Activity</label>
                        <button 
                          onClick={() => onViewPosts?.(data.id)}
                          className="w-full flex items-center justify-between p-3.5 bg-[#202c33] hover:bg-[#374248] rounded-xl transition-all group border border-white/5"
                        >
                          <div className="flex items-center gap-3">
                            <Rocket className="w-5 h-5 text-[#3b82f6] group-hover:scale-110 transition-transform" />
                            <div className="text-left">
                              <span className="text-[#e9edef] text-[15px] font-bold block">View Achievements</span>
                              <span className="text-[#8696a0] text-[11px]">See all projects & workshops</span>
                            </div>
                          </div>
                        </button>
                      </div>
                    )}

                    {/* Verification Badge — uses .border from switch */}
                    {data?.verification_level !== undefined && (
                      <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${getVerificationBadge(data.verification_level).border}`}>
                        <ShieldCheck className={`w-4 h-4 ${getVerificationBadge(data.verification_level).color}`} />
                        <span className={`text-xs font-medium ${getVerificationBadge(data.verification_level).color}`}>
                          {getVerificationBadge(data.verification_level).label}
                        </span>
                      </div>
                    )}

                    {/* Real Name */}
                    <div className="space-y-2">
                      <label className="text-[#00a884] text-xs font-medium uppercase tracking-wider">Name</label>
                      <p className="text-[#e9edef] text-lg font-medium">{data?.name || 'Unknown'}</p>
                    </div>

                    {/* Student: college + course */}
                    {data?.role === 'student' && data?.college_name && (
                      <div className="space-y-1">
                        <label className="text-[#00a884] text-xs font-medium uppercase tracking-wider">College</label>
                        <div className="flex items-center gap-2">
                          <GraduationCap className="w-4 h-4 text-[#8696a0]" />
                          <p className="text-[#8696a0]">{data.college_name}</p>
                        </div>
                      </div>
                    )}
                    {data?.role === 'student' && data?.course && (
                      <div className="space-y-1">
                        <label className="text-[#00a884] text-xs font-medium uppercase tracking-wider">Course</label>
                        <div className="flex items-center gap-2">
                          <BookOpen className="w-4 h-4 text-[#8696a0]" />
                          <p className="text-[#8696a0]">{data.course}</p>
                        </div>
                      </div>
                    )}

                    {/* Professional: company + job role */}
                    {data?.role === 'professional' && companyName && (
                      <div className="space-y-1">
                        <label className="text-[#00a884] text-xs font-medium uppercase tracking-wider">Company</label>
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-[#8696a0]" />
                          <p className="text-[#8696a0]">{companyName}</p>
                        </div>
                      </div>
                    )}
                    {data?.role === 'professional' && data?.job_role && (
                      <div className="space-y-1">
                        <label className="text-[#00a884] text-xs font-medium uppercase tracking-wider">Role</label>
                        <div className="flex items-center gap-2">
                          <Briefcase className="w-4 h-4 text-[#8696a0]" />
                          <p className="text-[#8696a0]">{data.job_role}{data.experience_years ? ` · ${data.experience_years} yrs exp` : ''}</p>
                        </div>
                      </div>
                    )}

                    {/* Skills */}
                    {data?.skills?.length > 0 && (
                      <div className="space-y-2">
                        <label className="text-[#00a884] text-xs font-medium uppercase tracking-wider">Skills</label>
                        <SkillPills skills={data.skills} small />
                      </div>
                    )}

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
                      <div className="flex items-start gap-3">
                        <Info className="w-5 h-5 text-[#8696a0] shrink-0 mt-0.5" />
                        <p className="text-[#8696a0] text-sm leading-relaxed">{data?.bio || 'Hey there! I am using Connectly.'}</p>
                      </div>
                    </div>

                    {/* Social Links (Always Visible) */}
                    {(data?.linkedin || data?.github || data?.portfolio) && (
                      <div className="space-y-3 pt-1">
                        <label className="text-[#00a884] text-xs font-medium uppercase tracking-wider">Networking Links</label>
                        <div className="flex flex-col gap-2">
                          {data.linkedin && (
                            <a href={data.linkedin} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-3 bg-[#2a3942] hover:bg-[#374248] rounded-xl transition-all border border-white/5">
                              <div className="flex items-center gap-2.5">
                                <Link className="w-4 h-4 text-[#00a884]" />
                                <span className="text-[#e9edef] text-xs font-medium">LinkedIn Profile</span>
                              </div>
                              <Globe className="w-3.5 h-3.5 text-[#8696a0]" />
                            </a>
                          )}
                          {data.github && (
                            <a href={`https://github.com/${data.github}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-3 bg-[#2a3942] hover:bg-[#374248] rounded-xl transition-all border border-white/5">
                              <div className="flex items-center gap-2.5">
                                <Globe className="w-4 h-4 text-white" />
                                <span className="text-[#e9edef] text-xs font-medium">GitHub Repository</span>
                              </div>
                              <Globe className="w-3.5 h-3.5 text-[#8696a0]" />
                            </a>
                          )}
                          {data.portfolio && (
                            <a href={data.portfolio} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-3 bg-[#2a3942] hover:bg-[#374248] rounded-xl transition-all border border-white/5">
                              <div className="flex items-center gap-2.5">
                                <Link className="w-4 h-4 text-[#3b82f6]" />
                                <span className="text-[#e9edef] text-xs font-medium">Personal Portfolio</span>
                              </div>
                              <Globe className="w-3.5 h-3.5 text-[#8696a0]" />
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* ===== GROUP MODE ===== */}
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
