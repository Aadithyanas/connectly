'use client'

import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import Link from 'next/link'
import { Shield, Zap, Users, ArrowRight, Lock, MessageCircle } from 'lucide-react'
import { motion } from 'framer-motion'

export default function Home() {
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) router.push('/chat')
    }
    checkUser()
  }, [supabase, router])

  return (
    <div className="min-h-[100dvh] bg-black flex flex-col items-center px-5 sm:px-6 py-16 md:py-24 text-white overflow-x-hidden relative">
      {/* Subtle gradient */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-white/[0.02] rounded-full blur-[120px] pointer-events-none" />

      <main className="max-w-5xl w-full z-10 flex flex-col items-center gap-16 md:gap-20">
        {/* Hero */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="text-center space-y-8"
        >
          <div className="flex flex-col items-center">
            <h1 className="text-5xl sm:text-7xl md:text-[100px] font-black tracking-[-0.04em] leading-none mb-6">
              Nexus
            </h1>
            <p className="text-zinc-500 text-base sm:text-lg md:text-xl font-medium max-w-lg mx-auto leading-relaxed px-4">
              Where ambitious students connect with verified industry professionals. Real conversations. Real growth.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mt-4 px-4">
            <Link
              href="/login"
              className="group px-8 sm:px-10 py-4 bg-white text-black font-bold rounded-full transition-all duration-200 hover:bg-zinc-200 active:scale-[0.97] flex items-center gap-3 text-sm sm:text-base"
            >
              Get Started
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            
            <div className="flex items-center gap-3 text-zinc-600 text-sm bg-white/[0.03] px-5 py-3 rounded-full border border-white/[0.06]">
              <span className="w-1.5 h-1.5 bg-white/50 rounded-full" />
              <p className="font-medium">One-click Google login</p>
            </div>
          </div>
        </motion.div>

        {/* Features */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 w-full px-1"
        >
          {[
            { icon: <Lock className="w-5 h-5" />, title: 'Private & Secure', desc: 'End-to-end encrypted conversations with row-level security policies.' },
            { icon: <Zap className="w-5 h-5" />, title: 'Real-time Messaging', desc: 'Instant delivery powered by Supabase Realtime. No delays, no refresh.' },
            { icon: <Users className="w-5 h-5" />, title: 'Verified Professionals', desc: 'Domain-verified industry experts you can trust for genuine advice.' },
          ].map((f, i) => (
            <div key={i} className="glass-card p-6 sm:p-8 rounded-2xl hover:bg-white/[0.05] transition-colors duration-300 flex flex-col gap-4">
              <div className="w-10 h-10 rounded-xl bg-white/[0.06] flex items-center justify-center text-zinc-400">
                {f.icon}
              </div>
              <div>
                <h3 className="text-white font-bold text-base sm:text-lg mb-1.5">{f.title}</h3>
                <p className="text-zinc-600 text-sm leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </motion.div>

        {/* Footer */}
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-zinc-700 text-[10px] sm:text-xs font-medium tracking-[0.15em] uppercase"
        >
          Built for the next generation
        </motion.p>
      </main>
    </div>
  )
}
