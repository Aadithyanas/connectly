'use client'

import { useState, useEffect, useRef, KeyboardEvent } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { GraduationCap, Briefcase, ChevronRight, X, Search, Globe, Loader2, CheckCircle2, Info, Plus, User, Building2, Code2, Link2, GitBranch, BookOpen, Award } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

type Role = 'student' | 'professional'

// ---------- Skill Tag Input ----------
function SkillTagInput({ skills, onChange }: { skills: string[]; onChange: (skills: string[]) => void }) {
  const [input, setInput] = useState('')
  const addSkill = () => {
    const trimmed = input.trim()
    if (trimmed && !skills.includes(trimmed)) onChange([...skills, trimmed])
    setInput('')
  }
  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addSkill() }
    if (e.key === 'Backspace' && !input && skills.length > 0) onChange(skills.slice(0, -1))
  }
  return (
    <div className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 flex flex-wrap gap-2 min-h-[52px] focus-within:ring-1 focus-within:ring-white/15 focus-within:border-white/12 transition-all cursor-text"
      onClick={() => document.getElementById('skill-input')?.focus()}>
      {skills.map(s => (
        <span key={s} className="flex items-center gap-1.5 bg-white/[0.06] text-zinc-300 text-xs px-3 py-1.5 rounded-lg font-medium border border-white/[0.06]">
          {s}
          <button type="button" onClick={e => { e.stopPropagation(); onChange(skills.filter(x => x !== s)) }}
            className="text-zinc-600 hover:text-white transition-colors"><X className="w-3 h-3" /></button>
        </span>
      ))}
      <input id="skill-input" type="text" value={input} onChange={e => setInput(e.target.value)}
        onKeyDown={handleKey} onBlur={addSkill}
        placeholder={skills.length === 0 ? 'React, Python, UI Design…' : '+ Add more'}
        className="bg-transparent border-none outline-none text-sm text-white placeholder-zinc-700 min-w-[120px] flex-1 ml-1" />
    </div>
  )
}

// ---------- Main ----------
export default function OnboardingPage() {
  const { user, profile, refreshProfile } = useAuth()
  const redirecting = useRef(false)
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState(1)
  const [role, setRole] = useState<Role | null>(null)
  const [loading, setLoading] = useState(false)
  const [creatingCompany, setCreatingCompany] = useState(false)
  const [companies, setCompanies] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [domainMatch, setDomainMatch] = useState<boolean | null>(null)

  const [formData, setFormData] = useState({
    name: '', college_name: '', course: '', skills: [] as string[],
    company_id: '', job_role: '', experience_years: 0,
    linkedin: '', github: '', portfolio: '',
  })

  useEffect(() => {
    if (profile?.role && !redirecting.current) {
      console.log('Profile has role, redirecting to chat...')
      redirecting.current = true
      router.replace('/chat')
      return 
    }
    if (user?.user_metadata?.full_name && !formData.name) setFormData(p => ({ ...p, name: user.user_metadata.full_name }))
    else if (user?.email && !formData.name) setFormData(p => ({ ...p, name: user.email!.split('@')[0] }))
    const fetch = async () => { const { data } = await supabase.from('companies').select('*').order('name'); if (data) setCompanies(data) }
    fetch()
  }, [profile, user])

  useEffect(() => {
    if (role !== 'professional' || !formData.company_id || !user?.email) { setDomainMatch(null); return }
    const sel = companies.find(c => c.id === formData.company_id)
    sel ? setDomainMatch(user.email.endsWith(`@${sel.domain}`)) : setDomainMatch(null)
  }, [formData.company_id, companies, user, role])

  const handleCreateCompany = async (name: string) => {
    if (!name || !user?.email) return
    setCreatingCompany(true)
    try {
      let d = user.email.split('@')[1]
      if (['gmail.com','outlook.com','hotmail.com','yahoo.com','icloud.com'].includes(d.toLowerCase())) d = `${user.id.slice(0,8)}.local`
      const { data, error } = await supabase.from('companies').insert([{ name, domain: d }]).select().single()
      if (error) { if (error.code === '23505') throw new Error(`"${name}" already exists.`); throw error }
      if (data) { setCompanies(p => [...p, data]); setFormData({ ...formData, company_id: data.id }); setSearch(data.name) }
    } catch (e: any) { alert(e.message || 'Failed.') } finally { setCreatingCompany(false) }
  }

  const handleComplete = async () => {
    if (!user) return; setLoading(true)
    try {
      let vl = 1
      if (role === 'professional' && formData.company_id) {
        const sc = companies.find(c => c.id === formData.company_id)
        if (sc && user.email?.endsWith(`@${sc.domain}`)) vl = 2
      }
      const p: Record<string, any> = {
        id: user.id,
        email: user.email,
        name: formData.name, role, skills: formData.skills, verification_level: vl, availability_status: true,
        linkedin: formData.linkedin || null, github: formData.github || null, portfolio: formData.portfolio || null,
        company_id: role === 'professional' ? formData.company_id : null,
        college_name: role === 'student' ? formData.college_name : null,
        course: role === 'student' ? (formData.course || null) : null,
        job_role: role === 'professional' ? formData.job_role : null,
        experience_years: role === 'professional' ? (formData.experience_years || null) : null,
        education: role === 'student' && formData.college_name ? [{ school: formData.college_name, degree: formData.course || '', startDate: '', endDate: '', present: false, description: '' }] : [],
        experience: role === 'professional' && formData.job_role ? [{ title: formData.job_role, company: companies.find(c => c.id === formData.company_id)?.name || '', startDate: '', endDate: '', present: true, description: '' }] : [],
      }
      console.log('Attempting profile upsert with payload:', p)
      
      // Use a timeout to detect hangs
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Database operation timed out after 30 seconds.')), 30000)
      })

      const apiRes = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(p)
      })

      if (!apiRes.ok) {
        const errorData = await apiRes.json()
        throw new Error(errorData.error || 'Failed to complete setup.')
      }
      
      console.log('Profile setup successful, initiating redirect...')
      if (!redirecting.current) {
        redirecting.current = true
        router.replace('/chat')
      }
    } catch (e: any) { 
      console.error('Onboarding flow interrupted:', e)
      alert(e.message?.includes('timed out') 
        ? 'Connection is slow. Please check your internet and try again.' 
        : (e.message || 'Failed to complete setup. Please check your connection and try again.')) 
    } finally { 
      setLoading(false) 
    }
  }

  const filtered = companies.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
  const valid = () => {
    if (!formData.name.trim()) return false
    if (role === 'student') return formData.college_name.trim().length > 0
    if (role === 'professional') return formData.company_id.length > 0
    return false
  }

  if (!user) return null

  const inputClass = "w-full bg-white/[0.03] border border-white/[0.06] rounded-xl py-3.5 text-white placeholder-zinc-700 focus:ring-1 focus:ring-white/15 focus:border-white/12 focus:bg-white/[0.05] outline-none transition-all text-sm"

  return (
    <div className="min-h-[100dvh] bg-black text-white flex flex-col items-center py-10 md:py-14 px-5 sm:px-6 relative overflow-x-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-white/[0.015] rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-3xl relative z-10">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-black tracking-[-0.03em] mb-2">Nexus</h1>
          <p className="text-zinc-600 text-xs font-bold uppercase tracking-[0.2em]">Step {step} of 2</p>
          <div className="max-w-[160px] mx-auto h-1 bg-white/[0.04] rounded-full overflow-hidden mt-4">
            <motion.div animate={{ width: `${(step / 2) * 100}%` }} className="h-full bg-white rounded-full" />
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          {step === 1 ? (
            <motion.div key="s1" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -24 }} className="space-y-8">
              <div className="text-center space-y-2">
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight">I am a…</h2>
                <p className="text-zinc-600 font-medium text-sm">Select your role to get started</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Student */}
                <button onClick={() => { setRole('student'); setStep(2) }}
                  className={`p-8 sm:p-10 rounded-2xl border transition-all duration-200 flex flex-col items-center gap-5 text-center ${
                    role === 'student' ? 'border-white/20 bg-white/[0.05]' : 'border-white/[0.06] hover:border-white/15 hover:bg-white/[0.02]'
                  }`}>
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all ${
                    role === 'student' ? 'bg-white text-black' : 'bg-white/[0.05] text-zinc-400'
                  }`}>
                    <GraduationCap className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Student</h3>
                    <p className="text-zinc-600 text-sm mt-2 leading-relaxed">Looking for mentorship, career guidance, and industry connections.</p>
                  </div>
                </button>

                {/* Professional */}
                <button onClick={() => { setRole('professional'); setStep(2) }}
                  className={`p-8 sm:p-10 rounded-2xl border transition-all duration-200 flex flex-col items-center gap-5 text-center ${
                    role === 'professional' ? 'border-white/20 bg-white/[0.05]' : 'border-white/[0.06] hover:border-white/15 hover:bg-white/[0.02]'
                  }`}>
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all ${
                    role === 'professional' ? 'bg-white text-black' : 'bg-white/[0.05] text-zinc-400'
                  }`}>
                    <Briefcase className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Professional</h3>
                    <p className="text-zinc-600 text-sm mt-2 leading-relaxed">Share expertise, mentor students, and grow your professional network.</p>
                  </div>
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div key="s2" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}
              className="glass-card rounded-2xl sm:rounded-3xl overflow-hidden">
              {/* Form Header */}
              <div className="p-5 sm:p-7 flex items-center justify-between border-b border-white/[0.04]">
                <div className="flex items-center gap-3">
                  <button onClick={() => setStep(1)} className="w-9 h-9 rounded-xl bg-white/[0.05] flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/[0.08] transition-all shrink-0 text-sm">←</button>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${role === 'professional' ? 'bg-white/[0.06] text-zinc-400' : 'bg-white/[0.06] text-zinc-400'}`}>
                    {role === 'professional' ? <Briefcase className="w-5 h-5" /> : <GraduationCap className="w-5 h-5" />}
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-white leading-tight">Complete Profile</h2>
                    <p className="text-zinc-600 text-xs font-medium">{role === 'student' ? 'Student' : 'Professional'}</p>
                  </div>
                </div>
              </div>

              <div className="p-5 sm:p-7 space-y-8 max-h-[70vh] md:max-h-[none] overflow-y-auto custom-scrollbar">
                {/* Identity */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-[0.12em]">Basic Info</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Full Name" required>
                      <div className="relative">
                        <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-700" />
                        <input type="text" placeholder="Your name" value={formData.name}
                          onChange={e => setFormData({ ...formData, name: e.target.value })}
                          className={`${inputClass} pl-11`} />
                      </div>
                    </Field>
                    {role === 'student' ? (
                      <Field label="University" required>
                        <div className="relative">
                          <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-700" />
                          <input type="text" placeholder="MIT, Stanford…" value={formData.college_name}
                            onChange={e => setFormData({ ...formData, college_name: e.target.value })}
                            className={`${inputClass} pl-11`} />
                        </div>
                      </Field>
                    ) : (
                      <Field label="Company" required>
                        <div className="relative">
                          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-700" />
                          <input type="text" placeholder="Google, Tesla…" className={`${inputClass} pl-11`}
                            value={search} onChange={e => { setSearch(e.target.value); setFormData({ ...formData, company_id: '' }) }} />
                          <AnimatePresence>
                            {search && !formData.company_id && (
                              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                className="absolute z-20 w-full mt-1.5 bg-[#0a0a0a] border border-white/[0.08] rounded-xl overflow-hidden shadow-2xl">
                                <div className="max-h-[180px] overflow-y-auto custom-scrollbar">
                                  {filtered.length > 0 ? (
                                    <>
                                      {filtered.map(c => (
                                        <button key={c.id} onClick={() => { setFormData({ ...formData, company_id: c.id }); setSearch(c.name) }}
                                          className="w-full text-left px-4 py-3 hover:bg-white/[0.04] transition-all flex items-center justify-between group">
                                          <div>
                                            <p className="text-white font-semibold text-sm">{c.name}</p>
                                            <p className="text-zinc-700 text-[10px] font-medium tracking-wider uppercase mt-0.5 group-hover:text-zinc-500 transition-colors">@{c.domain}</p>
                                          </div>
                                          <CheckCircle2 className="w-3.5 h-3.5 text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </button>
                                      ))}
                                      <div className="p-1.5 border-t border-white/[0.04]">
                                        <button onClick={() => handleCreateCompany(search)}
                                          className="w-full py-2 text-[10px] text-zinc-500 hover:text-white hover:bg-white/[0.04] rounded-lg transition-all flex items-center justify-center gap-1.5 font-bold uppercase tracking-wider">
                                          <Plus className="w-3 h-3" /> Add &quot;{search}&quot;
                                        </button>
                                      </div>
                                    </>
                                  ) : (
                                    <div className="p-4 text-center">
                                      <p className="text-zinc-600 text-sm mb-3">&quot;{search}&quot; not found</p>
                                      <button onClick={() => handleCreateCompany(search)} disabled={loading || creatingCompany}
                                        className="w-full py-2.5 bg-white text-black rounded-lg text-xs font-bold active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                                        {creatingCompany ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                                        Add &quot;{search}&quot;
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                        {formData.company_id && domainMatch !== null && (
                          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            className={`mt-2.5 px-3 py-2.5 rounded-lg flex items-center gap-2 text-xs font-medium border ${
                              domainMatch ? 'bg-white/[0.03] text-zinc-400 border-white/[0.06]' : 'bg-amber-500/5 text-amber-400/80 border-amber-500/10'
                            }`}>
                            {domainMatch ? <><CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> Domain verified</> : <><Info className="w-3.5 h-3.5 shrink-0" /> Personal email detected</>}
                          </motion.div>
                        )}
                      </Field>
                    )}
                  </div>
                </div>

                {/* Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-[0.12em]">Details</h3>
                    {role === 'student' ? (
                      <Field label="Field of Study">
                        <div className="relative">
                          <BookOpen className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-700" />
                          <input type="text" placeholder="Computer Science" value={formData.course}
                            onChange={e => setFormData({ ...formData, course: e.target.value })} className={`${inputClass} pl-11`} />
                        </div>
                      </Field>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Role" required>
                          <input type="text" placeholder="Engineer" value={formData.job_role}
                            onChange={e => setFormData({ ...formData, job_role: e.target.value })} className={`${inputClass} px-4`} />
                        </Field>
                        <Field label="Years Exp.">
                          <input type="number" min={0} max={50} placeholder="0" value={formData.experience_years || ''}
                            onChange={e => setFormData({ ...formData, experience_years: parseInt(e.target.value) || 0 })} className={`${inputClass} px-4`} />
                        </Field>
                      </div>
                    )}
                    <Field label="Skills" hint="Enter to add">
                      <SkillTagInput skills={formData.skills} onChange={skills => setFormData({ ...formData, skills })} />
                    </Field>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-[0.12em]">Links</h3>
                    {[
                      { icon: <Link2 className="w-4 h-4" />, ph: 'linkedin.com/in/…', key: 'linkedin' as const },
                      { icon: <GitBranch className="w-4 h-4" />, ph: 'github.com/…', key: 'github' as const },
                      { icon: <Globe className="w-4 h-4" />, ph: 'portfolio.dev', key: 'portfolio' as const },
                    ].map(l => (
                      <div key={l.key} className="flex items-center gap-2.5 bg-white/[0.03] border border-white/[0.06] rounded-xl px-3.5 py-2 focus-within:ring-1 focus-within:ring-white/10 focus-within:border-white/10 transition-all">
                        <span className="text-zinc-700 shrink-0">{l.icon}</span>
                        <input type={l.key === 'github' ? 'text' : 'url'} placeholder={l.ph}
                          className="w-full bg-transparent py-2 text-sm text-white placeholder-zinc-700 outline-none"
                          value={formData[l.key]} onChange={e => setFormData({ ...formData, [l.key]: e.target.value })} />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Submit */}
                <div className="pt-4 flex flex-col items-center">
                  <button onClick={handleComplete} disabled={loading || !valid()}
                    className="w-full max-w-xs bg-white text-black font-bold py-4 rounded-xl transition-all hover:bg-zinc-200 active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2.5 text-sm">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><span>Complete Setup</span><ChevronRight className="w-4 h-4" /></>}
                  </button>
                  <p className="mt-4 text-zinc-800 text-[9px] font-bold uppercase tracking-[0.15em]">Secure • Encrypted</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between px-0.5">
        <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.12em]">
          {label}{required && <span className="text-zinc-500 ml-0.5">*</span>}
        </label>
        {hint && <span className="text-[9px] font-medium text-zinc-700 uppercase tracking-wider">{hint}</span>}
      </div>
      {children}
    </div>
  )
}
