'use client'

import { useState, useEffect, KeyboardEvent } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { GraduationCap, Briefcase, ChevronRight, X, Search, Globe, Link, Loader2, Tag, CheckCircle2, Info, Plus } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

type Role = 'student' | 'professional'

// ---------- Skill Tag Input ----------
function SkillTagInput({
  skills,
  onChange,
}: {
  skills: string[]
  onChange: (skills: string[]) => void
}) {
  const [input, setInput] = useState('')

  const addSkill = () => {
    const trimmed = input.trim()
    if (trimmed && !skills.includes(trimmed)) {
      onChange([...skills, trimmed])
    }
    setInput('')
  }

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addSkill()
    }
    if (e.key === 'Backspace' && !input && skills.length > 0) {
      onChange(skills.slice(0, -1))
    }
  }

  return (
    <div className="w-full bg-[#111b21] rounded-xl p-3 flex flex-wrap gap-2 min-h-[50px] focus-within:ring-2 focus-within:ring-[#00a884] transition-all cursor-text"
      onClick={() => document.getElementById('skill-input')?.focus()}
    >
      {skills.map((s) => (
        <span
          key={s}
          className="flex items-center gap-1 bg-[#00a884]/15 text-[#00a884] text-sm px-2.5 py-1 rounded-full font-medium"
        >
          {s}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange(skills.filter(x => x !== s)) }}
            className="text-[#00a884]/60 hover:text-[#00a884] transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      <input
        id="skill-input"
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKey}
        onBlur={addSkill}
        placeholder={skills.length === 0 ? 'Type a skill and press Enter…' : '+ Add more'}
        className="bg-transparent border-none outline-none text-sm text-[#e9edef] placeholder-[#8696a0] min-w-[160px] flex-1"
      />
    </div>
  )
}

// ---------- Main Component ----------
export default function OnboardingPage() {
  const { user, profile, refreshProfile } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState(1)
  const [role, setRole] = useState<Role | null>(null)
  const [loading, setLoading] = useState(false)
  const [creatingCompany, setCreatingCompany] = useState(false)
  const [companies, setCompanies] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [domainMatch, setDomainMatch] = useState<boolean | null>(null)

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    college_name: '',
    course: '',
    skills: [] as string[],
    company_id: '',
    job_role: '',
    experience_years: 0,
    linkedin: '',
    github: '',
    portfolio: '',
  })

  useEffect(() => {
    if (profile?.role) {
      router.replace('/chat')
      return
    }

    // Pre-fill name from auth metadata
    if (user?.user_metadata?.full_name && !formData.name) {
      setFormData(prev => ({ ...prev, name: user.user_metadata.full_name }))
    } else if (user?.email && !formData.name) {
      // Fallback: use email prefix as name
      setFormData(prev => ({ ...prev, name: user.email!.split('@')[0] }))
    }

    const fetchCompanies = async () => {
      const { data } = await supabase.from('companies').select('*').order('name')
      if (data) setCompanies(data)
    }
    fetchCompanies()
  }, [profile, user])

  // Recalculate domain match whenever company selection changes
  useEffect(() => {
    if (role !== 'professional' || !formData.company_id || !user?.email) {
      setDomainMatch(null)
      return
    }
    const selected = companies.find(c => c.id === formData.company_id)
    if (selected) {
      setDomainMatch(user.email.endsWith(`@${selected.domain}`))
    } else {
      setDomainMatch(null)
    }
  }, [formData.company_id, companies, user, role])

  const handleCreateCompany = async (name: string) => {
    if (!name || !user?.email) return
    setCreatingCompany(true)
    try {
      let emailDomain = user.email.split('@')[1]
      
      // Safety: Do not use generic domains as unique company domains!
      // This prevents conflict between different users adding different companies using Gmail.
      const genericDomains = ['gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com', 'icloud.com']
      if (genericDomains.includes(emailDomain.toLowerCase())) {
        emailDomain = `${user.id.slice(0, 8)}.local`
      }
      
      const queryPromise = supabase
        .from('companies')
        .insert([{ name, domain: emailDomain }])
        .select()
        .single()

      const timeoutPromise = new Promise<{data: any, error: any}>((_, reject) => 
        setTimeout(() => reject(new Error("Database timeout! If this keeps happening, click again or check your internet.")), 10000)
      )

      console.log('Attempting to create company:', { name, domain: emailDomain })
      const { data: newCompany, error } = await Promise.race([queryPromise, timeoutPromise])

      if (error) {
        console.error("Supabase Error during company creation:", error)
        if (error.code === '23505') {
          throw new Error(`A company with the name "${name}" or domain "${emailDomain}" already exists.`)
        }
        throw error
      }

      if (newCompany) {
        setCompanies(prev => [...prev, newCompany])
        setFormData({ ...formData, company_id: newCompany.id })
        setSearch(newCompany.name)
      }
    } catch (err: any) {
      console.error("handleCreateCompany error:", err)
      alert(err.message || 'Failed to create company. Make sure you applied the SQL policy update.')
    } finally {
      setCreatingCompany(false)
    }
  }

  const handleCompleteOnboarding = async () => {
    console.log('1. handleCompleteOnboarding triggered')
    if (!user) {
      console.log('User is null, aborting.')
      return
    }
    console.log('2. User found:', user.id)
    setLoading(true)

    try {
      console.log('3. Entering try block')
      let verificationLevel = 1 // Completed profile → level 1

      if (role === 'professional' && formData.company_id) {
        const selectedCompany = companies.find(c => c.id === formData.company_id)
        if (selectedCompany && user.email?.endsWith(`@${selectedCompany.domain}`)) {
          verificationLevel = 2 // Domain verified → level 2
        }
      }

      console.log('4. Building payload')
      const payload: Record<string, any> = {
        name: formData.name,
        role: role,
        skills: formData.skills,
        verification_level: verificationLevel,
        availability_status: true,
        linkedin: formData.linkedin || null,
        github: formData.github || null,
        portfolio: formData.portfolio || null,
        company_id: role === 'professional' ? formData.company_id : null,
        college_name: role === 'student' ? formData.college_name : null,
        course: role === 'student' ? (formData.course || null) : null,
        job_role: role === 'professional' ? formData.job_role : null,
        experience_years: role === 'professional' ? (formData.experience_years || null) : null,
      }
      
      console.log('5. Payload prepared:', payload)
      console.log('6. Awaiting Supabase update...')

      // Force a 5-second timeout on the query to prevent infinite hanging
      const queryPromise = supabase.from('profiles').update(payload).eq('id', user.id).select()
      const timeoutPromise = new Promise<{data: any, error: any}>((_, reject) => 
        setTimeout(() => reject(new Error("Database connection timed out after 10 seconds! This usually happens if the database is locked or your connection is slow. Please try clicking 'Complete Setup' again.")), 10000)
      )

      const { data, error } = await Promise.race([queryPromise, timeoutPromise])
      console.log('8. Query returned data:', data, 'error:', error)

      if (error) throw new Error(error.message)
      
      if (!data || data.length === 0) {
        throw new Error("Your profile could not be found! Please refresh the page and try again.")
      }

      console.log('9. Calling refreshProfile...')
      await Promise.race([
        refreshProfile(),
        new Promise((_, r) => setTimeout(() => r(new Error("Profile refresh timed out (5s). Still proceeding to chat...")), 5000))
      ])
      
      console.log('10. Pushing to /chat...')
      
      // Navigate safely
      window.location.href = '/chat' // Force a hard navigation to bypass Next.js client cache completely
    } catch (err: any) {
      console.error('*** Onboarding error catch block ***:', err)
      alert(err.message || 'Failed to save profile. Please try again.')
    } finally {
      console.log('12. Finally block: setting loading false')
      setLoading(false)
    }
  }

  const filteredCompanies = companies.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  )

  const isStep2Valid = () => {
    if (!formData.name.trim()) return false
    if (role === 'student') return formData.college_name.trim().length > 0
    if (role === 'professional') return formData.company_id.length > 0
    return false
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-[#0d1317] text-[#e9edef] flex flex-col items-center justify-center p-4">
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[#00a884]/5 rounded-full blur-[120px]" />
      </div>

      <div className="w-full max-w-xl relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-[#00a884] items-center justify-center mb-4 shadow-xl shadow-[#00a884]/20">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <p className="text-[#8696a0] text-sm">Step {step} of 2</p>
        </div>

        {/* Progress bar */}
        <div className="flex gap-2 mb-8">
          {[1, 2].map((i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-all duration-500 ${step >= i ? 'bg-[#00a884]' : 'bg-[#2a3942]'}`}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* ===== STEP 1: ROLE SELECTION ===== */}
          {step === 1 ? (
            <motion.div
              key="step1"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.25 }}
              className="space-y-8"
            >
              <div className="text-center space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">Welcome to Connectly</h1>
                <p className="text-[#8696a0]">How are you joining the platform?</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Student Card */}
                <button
                  onClick={() => { setRole('student'); setStep(2) }}
                  className={`p-8 rounded-2xl border-2 transition-all duration-200 group flex flex-col items-center gap-4 text-center relative overflow-hidden ${
                    role === 'student'
                      ? 'border-[#00a884] bg-[#00a884]/8'
                      : 'border-[#2a3942] hover:border-[#00a884]/40 hover:bg-[#00a884]/5'
                  }`}
                >
                  <div className="w-16 h-16 rounded-2xl bg-[#00a884]/10 flex items-center justify-center text-[#00a884] group-hover:scale-110 transition-transform">
                    <GraduationCap className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">Student</h3>
                    <p className="text-[#8696a0] text-sm mt-1">Connect with industry professionals and grow your career</p>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5 justify-center">
                    {['Networking', 'Mentorship', 'Learning'].map(t => (
                      <span key={t} className="text-[10px] uppercase tracking-wider text-[#00a884]/70 bg-[#00a884]/10 px-2 py-0.5 rounded-full">{t}</span>
                    ))}
                  </div>
                </button>

                {/* Professional Card */}
                <button
                  onClick={() => { setRole('professional'); setStep(2) }}
                  className={`p-8 rounded-2xl border-2 transition-all duration-200 group flex flex-col items-center gap-4 text-center relative overflow-hidden ${
                    role === 'professional'
                      ? 'border-[#3b82f6] bg-[#3b82f6]/8'
                      : 'border-[#2a3942] hover:border-[#3b82f6]/40 hover:bg-[#3b82f6]/5'
                  }`}
                >
                  <div className="w-16 h-16 rounded-2xl bg-[#3b82f6]/10 flex items-center justify-center text-[#3b82f6] group-hover:scale-110 transition-transform">
                    <Briefcase className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">Professional</h3>
                    <p className="text-[#8696a0] text-sm mt-1">Share your expertise and mentor the next generation</p>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5 justify-center">
                    {['Mentoring', 'Visibility', 'Impact'].map(t => (
                      <span key={t} className="text-[10px] uppercase tracking-wider text-[#3b82f6]/70 bg-[#3b82f6]/10 px-2 py-0.5 rounded-full">{t}</span>
                    ))}
                  </div>
                </button>
              </div>
            </motion.div>

          ) : (
            /* ===== STEP 2: PROFILE FORM ===== */
            <motion.div
              key="step2"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.25 }}
              className="bg-[#202c33] rounded-3xl shadow-2xl border border-white/5 overflow-hidden"
            >
              {/* Form header */}
              <div className={`p-5 flex items-center gap-3 border-b border-[#2a3942] ${role === 'professional' ? 'bg-[#3b82f6]/5' : 'bg-[#00a884]/5'}`}>
                <button
                  onClick={() => setStep(1)}
                  className="p-1.5 rounded-lg text-[#8696a0] hover:text-[#e9edef] hover:bg-[#374248] transition-all"
                >
                  ←
                </button>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${role === 'professional' ? 'bg-[#3b82f6]/20 text-[#3b82f6]' : 'bg-[#00a884]/20 text-[#00a884]'}`}>
                  {role === 'professional' ? <Briefcase className="w-4 h-4" /> : <GraduationCap className="w-4 h-4" />}
                </div>
                <div>
                  <h2 className="text-[#e9edef] font-bold text-base leading-tight">Complete your profile</h2>
                  <p className="text-[#8696a0] text-xs">{role === 'student' ? 'Student' : 'Professional'} account</p>
                </div>
              </div>

              <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto custom-scrollbar">
                {/* Full Name */}
                <Field label="Full Name" required>
                  <input
                    type="text"
                    placeholder="Your full name"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-[#111b21] rounded-xl py-3 px-4 text-[#e9edef] placeholder-[#8696a0] focus:ring-2 focus:ring-[#00a884] border-none transition-all outline-none"
                  />
                </Field>

                {/* ===== STUDENT FIELDS ===== */}
                {role === 'student' && (
                  <>
                    <Field label="College / University" required>
                      <input
                        type="text"
                        placeholder="e.g. Stanford University"
                        value={formData.college_name}
                        onChange={e => setFormData({ ...formData, college_name: e.target.value })}
                        className="w-full bg-[#111b21] rounded-xl py-3 px-4 text-[#e9edef] placeholder-[#8696a0] focus:ring-2 focus:ring-[#00a884] border-none transition-all outline-none"
                      />
                    </Field>

                    <Field label="Course / Field of Study" hint="Optional">
                      <input
                        type="text"
                        placeholder="e.g. Computer Science"
                        value={formData.course}
                        onChange={e => setFormData({ ...formData, course: e.target.value })}
                        className="w-full bg-[#111b21] rounded-xl py-3 px-4 text-[#e9edef] placeholder-[#8696a0] focus:ring-2 focus:ring-[#00a884] border-none transition-all outline-none"
                      />
                    </Field>
                  </>
                )}

                {/* ===== PROFESSIONAL FIELDS ===== */}
                {role === 'professional' && (
                  <>
                    {/* Company Dropdown */}
                    <Field label="Company" required>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8696a0] pointer-events-none" />
                        <input
                          type="text"
                          placeholder="Search for your company…"
                          className="w-full bg-[#111b21] rounded-xl py-3 pl-10 pr-4 text-[#e9edef] placeholder-[#8696a0] focus:ring-2 focus:ring-[#00a884] border-none transition-all outline-none"
                          value={search}
                          onChange={e => { setSearch(e.target.value); setFormData({ ...formData, company_id: '' }) }}
                        />
                        {search && !formData.company_id && (
                          <div className="absolute z-20 w-full mt-1.5 bg-[#111b21] border border-[#2a3942] rounded-xl overflow-hidden shadow-2xl max-h-[220px] overflow-y-auto custom-scrollbar">
                            {filteredCompanies.length > 0 ? (
                              <>
                                {filteredCompanies.map(c => (
                                  <button
                                    key={c.id}
                                    onClick={() => { setFormData({ ...formData, company_id: c.id }); setSearch(c.name) }}
                                    className="w-full text-left px-4 py-3 hover:bg-[#202c33] transition-colors flex items-center justify-between text-sm"
                                  >
                                    <span className="text-[#e9edef] font-medium">{c.name}</span>
                                    <span className="text-[#8696a0] text-xs">@{c.domain}</span>
                                  </button>
                                ))}
                                {/* Still allow adding if they want a specific name */}
                                <div className="p-2 border-t border-[#2a3942] bg-[#1a2227]/50">
                                  <button
                                    onClick={() => handleCreateCompany(search)}
                                    className="w-full py-2 px-3 text-xs text-[#00a884] hover:bg-[#00a884]/10 rounded-lg transition-all flex items-center justify-center gap-2 font-medium"
                                  >
                                    <Plus className="w-3 h-3" /> Still can't find it? Add "{search}"
                                  </button>
                                </div>
                              </>
                            ) : (
                              <div className="p-4 text-center">
                                <p className="text-[#8696a0] text-sm mb-3">No results for "{search}"</p>
                                <button
                                  onClick={() => handleCreateCompany(search)}
                                  disabled={loading || creatingCompany}
                                  className="w-full py-2.5 px-4 bg-[#00a884] text-white rounded-xl text-sm font-bold shadow-lg shadow-[#00a884]/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                                >
                                  {creatingCompany ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                  Add "{search}" as new company
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Domain match hint */}
                      {formData.company_id && domainMatch !== null && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className={`mt-2 px-3 py-2 rounded-lg flex items-center gap-2 text-sm ${
                            domainMatch
                              ? 'bg-[#00a884]/10 text-[#00a884]'
                              : 'bg-[#f59e0b]/10 text-[#f59e0b]'
                          }`}
                        >
                          {domainMatch ? (
                            <><CheckCircle2 className="w-4 h-4 shrink-0" /> Your email domain matches — you'll get <strong>Verified Profile</strong> status (Level 2)</>
                          ) : (
                            <><Info className="w-4 h-4 shrink-0" /> Email domain doesn't match. You'll start at <strong>Profile Added</strong> (Level 1)</>
                          )}
                        </motion.div>
                      )}
                    </Field>

                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Job Role" required>
                        <input
                          type="text"
                          placeholder="e.g. Software Engineer"
                          value={formData.job_role}
                          onChange={e => setFormData({ ...formData, job_role: e.target.value })}
                          className="w-full bg-[#111b21] rounded-xl py-3 px-4 text-[#e9edef] placeholder-[#8696a0] focus:ring-2 focus:ring-[#00a884] border-none transition-all outline-none"
                        />
                      </Field>
                      <Field label="Experience (years)">
                        <input
                          type="number"
                          min={0}
                          max={50}
                          placeholder="0"
                          value={formData.experience_years || ''}
                          onChange={e => setFormData({ ...formData, experience_years: parseInt(e.target.value) || 0 })}
                          className="w-full bg-[#111b21] rounded-xl py-3 px-4 text-[#e9edef] placeholder-[#8696a0] focus:ring-2 focus:ring-[#00a884] border-none transition-all outline-none"
                        />
                      </Field>
                    </div>
                  </>
                )}

                {/* ===== SKILLS (Both Roles) ===== */}
                <Field label="Skills" hint="Optional — press Enter or comma to add">
                  <SkillTagInput
                    skills={formData.skills}
                    onChange={skills => setFormData({ ...formData, skills })}
                  />
                </Field>

                {/* ===== OPTIONAL LINKS ===== */}
                <div className="space-y-3 pt-1">
                  <p className="text-xs font-medium text-[#8696a0] uppercase tracking-wider">Portfolio & Social Links <span className="normal-case">(optional)</span></p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="relative">
                      <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8696a0]" />
                      <input
                        type="url"
                        placeholder="LinkedIn URL"
                        className="w-full bg-[#111b21] rounded-xl py-2.5 pl-9 pr-3 text-sm text-[#e9edef] placeholder-[#8696a0] focus:ring-2 focus:ring-[#00a884] border-none transition-all outline-none"
                        value={formData.linkedin}
                        onChange={e => setFormData({ ...formData, linkedin: e.target.value })}
                      />
                    </div>
                    <div className="relative">
                      <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8696a0]" />
                      <input
                        type="text"
                        placeholder="GitHub username"
                        className="w-full bg-[#111b21] rounded-xl py-2.5 pl-9 pr-3 text-sm text-[#e9edef] placeholder-[#8696a0] focus:ring-2 focus:ring-[#00a884] border-none transition-all outline-none"
                        value={formData.github}
                        onChange={e => setFormData({ ...formData, github: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="relative">
                    <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8696a0]" />
                    <input
                      type="url"
                      placeholder="Portfolio website URL"
                      className="w-full bg-[#111b21] rounded-xl py-2.5 pl-9 pr-3 text-sm text-[#e9edef] placeholder-[#8696a0] focus:ring-2 focus:ring-[#00a884] border-none transition-all outline-none"
                      value={formData.portfolio}
                      onChange={e => setFormData({ ...formData, portfolio: e.target.value })}
                    />
                  </div>
                </div>

                {/* Submit */}
                <button
                  onClick={handleCompleteOnboarding}
                  disabled={loading || !isStep2Valid()}
                  className={`w-full mt-2 font-bold py-4 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed ${
                    role === 'professional'
                      ? 'bg-[#3b82f6] hover:bg-[#2563eb] text-white shadow-[#3b82f6]/20'
                      : 'bg-[#00a884] hover:bg-[#008f6f] text-[#111b21] shadow-[#00a884]/20'
                  }`}
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      Complete Setup
                      <ChevronRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ---------- Helper: Field Wrapper ----------
function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string
  hint?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-xs font-medium text-[#8696a0] uppercase tracking-wider ml-0.5">
        {label}
        {required && <span className="text-[#00a884]">*</span>}
        {hint && <span className="normal-case text-[#8696a0]/60 text-[10px]">— {hint}</span>}
      </label>
      {children}
    </div>
  )
}
