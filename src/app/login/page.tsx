'use client'

import { createClient } from '@/utils/supabase/client'
import { LogIn } from 'lucide-react'
import Image from 'next/image'

export default function LoginPage() {
  const supabase = createClient()

  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#111b21] text-white selection:bg-[#00a884]/30">
      <div className="w-full max-w-md p-8 flex flex-col items-center gap-8 animate-in fade-in zoom-in duration-500">
        {/* Logo/Icon Area */}
        <div className="relative w-24 h-24 bg-[#00a884] rounded-full flex items-center justify-center shadow-2xl shadow-[#00a884]/20 group">
          <LogIn className="w-12 h-12 text-white group-hover:scale-110 transition-transform duration-300" />
          <div className="absolute -inset-1 bg-[#00a884] rounded-full blur-lg opacity-20 group-hover:opacity-40 transition-opacity"></div>
        </div>

        {/* Text Content */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-[#e9edef]">Connectly</h1>
          <p className="text-[#8696a0] text-lg">Simple. Secure. Real-time messaging.</p>
        </div>

        {/* Login Button */}
        <button
          onClick={handleLogin}
          className="w-full flex items-center justify-center gap-3 bg-[#00a884] hover:bg-[#008f6f] text-[#111b21] font-bold py-4 px-6 rounded-full transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg"
        >
          <svg className="w-6 h-6" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Continue with Google
        </button>

        {/* Footer info */}
        <div className="mt-8 pt-8 border-t border-[#2a3942] w-full text-center">
          <p className="text-[#667781] text-sm">
            By continuing, you agree to Connectly's Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  )
}
