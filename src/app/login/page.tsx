'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { LogIn, ArrowRight, Eye, EyeOff, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function LoginPage() {
  const supabase = createClient()
  const [tab, setTab] = useState<'login' | 'register'>('login')

  // Register state
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regShowPw, setRegShowPw] = useState(false)
  const [regLoading, setRegLoading] = useState(false)
  const [regMessage, setRegMessage] = useState('')

  // Login state
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
    if (error) {
      setRegMessage(error.message)
    } else {
      setRegMessage('✅ Check your email to confirm your account, then come back to log in!')
    }
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
    if (error) {
      setLoginError(error.message)
      setLoginLoading(false)
    }
    // On success, the auth state change will trigger a redirect via middleware
  }

  const GoogleIcon = () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24">
      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#111b21] text-[#e9edef] p-4 selection:bg-[#00a884]/30">
      <div className="w-full max-w-md flex flex-col items-center gap-8">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative w-20 h-20 bg-[#00a884] rounded-full flex items-center justify-center shadow-2xl shadow-[#00a884]/20">
            <LogIn className="w-10 h-10 text-white" />
            <div className="absolute -inset-1 bg-[#00a884] rounded-full blur-xl opacity-20" />
          </div>
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-[#e9edef]">Connectly</h1>
            <p className="text-[#8696a0] mt-1">Students meet Professionals</p>
          </div>
        </div>

        {/* Card */}
        <div className="w-full bg-[#202c33] rounded-3xl shadow-2xl border border-white/5 overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-[#2a3942]">
            {(['login', 'register'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider transition-colors ${
                  tab === t ? 'text-[#00a884] border-b-2 border-[#00a884]' : 'text-[#8696a0] hover:text-[#e9edef]'
                }`}
              >
                {t === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          <div className="p-8 space-y-6">
            <AnimatePresence mode="wait">
              {tab === 'register' ? (
                <motion.form
                  key="register"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  onSubmit={handleRegister}
                  className="space-y-4"
                >
                  <p className="text-[#8696a0] text-sm text-center pb-2">
                    Create your account first, then complete your profile to get verified.
                  </p>
                  <div className="space-y-1">
                    <label className="text-xs text-[#8696a0] uppercase tracking-wider font-medium ml-1">Email</label>
                    <input
                      type="email"
                      required
                      placeholder="you@example.com"
                      value={regEmail}
                      onChange={e => setRegEmail(e.target.value)}
                      className="w-full bg-[#111b21] rounded-xl py-3 px-4 text-[#e9edef] placeholder-[#8696a0] focus:ring-2 focus:ring-[#00a884] border-none transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-[#8696a0] uppercase tracking-wider font-medium ml-1">Password</label>
                    <div className="relative">
                      <input
                        type={regShowPw ? 'text' : 'password'}
                        required
                        minLength={6}
                        placeholder="Min. 6 characters"
                        value={regPassword}
                        onChange={e => setRegPassword(e.target.value)}
                        className="w-full bg-[#111b21] rounded-xl py-3 px-4 pr-12 text-[#e9edef] placeholder-[#8696a0] focus:ring-2 focus:ring-[#00a884] border-none transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setRegShowPw(!regShowPw)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8696a0] hover:text-[#e9edef]"
                      >
                        {regShowPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  {regMessage && (
                    <p className={`text-sm text-center px-3 py-2 rounded-lg ${regMessage.startsWith('✅') ? 'bg-[#00a884]/10 text-[#00a884]' : 'bg-red-500/10 text-red-400'}`}>
                      {regMessage}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={regLoading}
                    className="w-full flex items-center justify-center gap-2 bg-[#00a884] hover:bg-[#008f6f] disabled:opacity-50 text-[#111b21] font-bold py-3.5 rounded-xl transition-all shadow-lg mt-2"
                  >
                    {regLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><span>Create Account</span><ArrowRight className="w-5 h-5" /></>}
                  </button>

                  <div className="relative flex items-center gap-4 py-2">
                    <div className="flex-1 h-px bg-[#2a3942]" />
                    <span className="text-[#8696a0] text-xs uppercase">or</span>
                    <div className="flex-1 h-px bg-[#2a3942]" />
                  </div>

                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    className="w-full flex items-center justify-center gap-3 bg-[#2a3942] hover:bg-[#374248] text-[#e9edef] font-medium py-3.5 px-6 rounded-xl transition-all border border-white/5"
                  >
                    <GoogleIcon />
                    Sign up with Google
                  </button>
                </motion.form>
              ) : (
                <motion.form
                  key="login"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  onSubmit={handleEmailLogin}
                  className="space-y-4"
                >
                  <div className="space-y-1">
                    <label className="text-xs text-[#8696a0] uppercase tracking-wider font-medium ml-1">Email</label>
                    <input
                      type="email"
                      required
                      placeholder="you@example.com"
                      value={loginEmail}
                      onChange={e => setLoginEmail(e.target.value)}
                      className="w-full bg-[#111b21] rounded-xl py-3 px-4 text-[#e9edef] placeholder-[#8696a0] focus:ring-2 focus:ring-[#00a884] border-none transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-[#8696a0] uppercase tracking-wider font-medium ml-1">Password</label>
                    <div className="relative">
                      <input
                        type={loginShowPw ? 'text' : 'password'}
                        required
                        placeholder="Your password"
                        value={loginPassword}
                        onChange={e => setLoginPassword(e.target.value)}
                        className="w-full bg-[#111b21] rounded-xl py-3 px-4 pr-12 text-[#e9edef] placeholder-[#8696a0] focus:ring-2 focus:ring-[#00a884] border-none transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setLoginShowPw(!loginShowPw)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8696a0] hover:text-[#e9edef]"
                      >
                        {loginShowPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  {loginError && (
                    <p className="text-sm text-center px-3 py-2 rounded-lg bg-red-500/10 text-red-400">{loginError}</p>
                  )}
                  <button
                    type="submit"
                    disabled={loginLoading}
                    className="w-full flex items-center justify-center gap-2 bg-[#00a884] hover:bg-[#008f6f] disabled:opacity-50 text-[#111b21] font-bold py-3.5 rounded-xl transition-all shadow-lg mt-2"
                  >
                    {loginLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><span>Sign In</span><ArrowRight className="w-5 h-5" /></>}
                  </button>

                  <div className="relative flex items-center gap-4 py-2">
                    <div className="flex-1 h-px bg-[#2a3942]" />
                    <span className="text-[#8696a0] text-xs uppercase">or</span>
                    <div className="flex-1 h-px bg-[#2a3942]" />
                  </div>

                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    className="w-full flex items-center justify-center gap-3 bg-[#2a3942] hover:bg-[#374248] text-[#e9edef] font-medium py-3.5 px-6 rounded-xl transition-all border border-white/5"
                  >
                    <GoogleIcon />
                    Continue with Google
                  </button>

                  <p className="text-center text-[#8696a0] text-sm">
                    No account?{' '}
                    <button type="button" onClick={() => setTab('register')} className="text-[#00a884] hover:underline font-medium">
                      Create one
                    </button>
                  </p>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </div>

        <p className="text-[#667781] text-xs text-center">
          By continuing, you agree to Connectly's Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  )
}
