'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { ArrowRight, Eye, EyeOff, Loader2, Mail, Lock, UserPlus, LogIn } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function LoginPage() {
  const supabase = createClient()
  const [tab, setTab] = useState<'login' | 'register'>('login')

  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regShowPw, setRegShowPw] = useState(false)
  const [regLoading, setRegLoading] = useState(false)
  const [regMessage, setRegMessage] = useState('')

  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginShowPw, setLoginShowPw] = useState(false)
  const [loginLoading, setLoginLoading] = useState(false)
  const [loginError, setLoginError] = useState('')

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setRegLoading(true)
    setRegMessage('')
    const { error } = await supabase.auth.signUp({
      email: regEmail,
      password: regPassword,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) setRegMessage(error.message)
    else setRegMessage('✅ Check your email to confirm, then come back to sign in.')
    setRegLoading(false)
  }

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginLoading(true)
    setLoginError('')
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    })
    if (error) { setLoginError(error.message); setLoginLoading(false) }
  }

  const inputClass = "w-full bg-white/[0.03] border border-white/[0.06] rounded-xl py-3.5 sm:py-4 pl-12 pr-4 text-white placeholder-zinc-600 focus:ring-1 focus:ring-white/20 focus:border-white/15 focus:bg-white/[0.05] outline-none transition-all text-sm"

  return (
    <div className="min-h-screen flex flex-col items-center py-12 md:py-16 bg-black text-white px-5 sm:px-6 relative overflow-x-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-white/[0.015] rounded-full blur-[120px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-[420px] flex flex-col items-center gap-10 relative z-10"
      >
        {/* Brand */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl sm:text-5xl font-black tracking-[-0.04em]">Nexus</h1>
          <p className="text-zinc-600 font-medium text-sm">Sign in to your professional network</p>
        </div>

        {/* Card */}
        <div className="w-full glass-card rounded-2xl sm:rounded-3xl overflow-hidden">
          {/* Tabs */}
          <div className="flex p-1.5 gap-1.5 border-b border-white/[0.04]">
            {(['login', 'register'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex-1 py-3 text-xs font-bold uppercase tracking-[0.1em] transition-all rounded-xl flex items-center justify-center gap-2 ${
                  tab === t ? 'bg-white text-black' : 'text-zinc-600 hover:text-zinc-400 hover:bg-white/[0.03]'
                }`}>
                {t === 'login' ? <><LogIn className="w-3.5 h-3.5" /> Sign In</> : <><UserPlus className="w-3.5 h-3.5" /> Register</>}
              </button>
            ))}
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            <AnimatePresence mode="wait">
              {tab === 'register' ? (
                <motion.form key="register" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}
                  onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-3">
                    <label className="text-[10px] text-zinc-500 uppercase tracking-[0.15em] font-bold ml-0.5">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                      <input type="email" required placeholder="you@email.com" value={regEmail}
                        onChange={e => setRegEmail(e.target.value)} className={inputClass} />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] text-zinc-500 uppercase tracking-[0.15em] font-bold ml-0.5">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                      <input type={regShowPw ? 'text' : 'password'} required minLength={6} placeholder="Min 6 characters"
                        value={regPassword} onChange={e => setRegPassword(e.target.value)}
                        className={`${inputClass} pr-12`} />
                      <button type="button" onClick={() => setRegShowPw(!regShowPw)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-white transition-colors">
                        {regShowPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  {regMessage && (
                    <p className={`text-xs text-center px-4 py-3 rounded-xl font-medium ${regMessage.startsWith('✅') ? 'bg-white/5 text-zinc-300 border border-white/10' : 'bg-red-500/5 text-red-400 border border-red-500/10'}`}>
                      {regMessage}
                    </p>
                  )}
                  <button type="submit" disabled={regLoading}
                    className="w-full flex items-center justify-center gap-2.5 bg-white text-black font-bold py-3.5 rounded-xl transition-all hover:bg-zinc-200 active:scale-[0.98] disabled:opacity-50 text-sm mt-2">
                    {regLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><span>Create Account</span><ArrowRight className="w-4 h-4" /></>}
                  </button>
                </motion.form>
              ) : (
                <motion.form key="login" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }}
                  onSubmit={handleEmailLogin} className="space-y-4">
                  <div className="space-y-3">
                    <label className="text-[10px] text-zinc-500 uppercase tracking-[0.15em] font-bold ml-0.5">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                      <input type="email" required placeholder="you@email.com" value={loginEmail}
                        onChange={e => setLoginEmail(e.target.value)} className={inputClass} />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] text-zinc-500 uppercase tracking-[0.15em] font-bold ml-0.5">Password</label>
                      <button type="button" className="text-[10px] text-zinc-600 hover:text-white uppercase tracking-wider font-bold transition-colors">Forgot?</button>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                      <input type={loginShowPw ? 'text' : 'password'} required placeholder="••••••••"
                        value={loginPassword} onChange={e => setLoginPassword(e.target.value)}
                        className={`${inputClass} pr-12`} />
                      <button type="button" onClick={() => setLoginShowPw(!loginShowPw)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-white transition-colors">
                        {loginShowPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  {loginError && (
                    <p className="text-xs text-center px-4 py-3 rounded-xl bg-red-500/5 text-red-400 border border-red-500/10 font-medium">{loginError}</p>
                  )}
                  <button type="submit" disabled={loginLoading}
                    className="w-full flex items-center justify-center gap-2.5 bg-white text-black font-bold py-3.5 rounded-xl transition-all hover:bg-zinc-200 active:scale-[0.98] disabled:opacity-50 text-sm mt-2">
                    {loginLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><span>Sign In</span><ArrowRight className="w-4 h-4" /></>}
                  </button>
                </motion.form>
              )}
            </AnimatePresence>

            {/* Divider */}
            <div className="relative flex items-center gap-3">
              <div className="flex-1 h-px bg-white/[0.06]" />
              <span className="text-[10px] text-zinc-700 uppercase tracking-[0.2em] font-bold">or</span>
              <div className="flex-1 h-px bg-white/[0.06]" />
            </div>

            {/* Google */}
            <button type="button" onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-3 bg-white/[0.04] hover:bg-white/[0.07] text-white font-semibold py-3.5 rounded-xl transition-all border border-white/[0.06] active:scale-[0.98] text-sm">
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="currentColor"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="currentColor"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="currentColor"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="currentColor"/>
              </svg>
              <span>Continue with Google</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <p className="text-zinc-700 text-[10px] font-medium max-w-[300px] text-center leading-relaxed">
          By joining, you agree to Nexus <span className="text-zinc-500 hover:text-white cursor-pointer transition-colors">Terms</span> and <span className="text-zinc-500 hover:text-white cursor-pointer transition-colors">Privacy Policy</span>.
        </p>
      </motion.div>
    </div>
  )
}
