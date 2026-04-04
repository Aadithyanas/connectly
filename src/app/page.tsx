import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { MessageSquare } from 'lucide-react'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect('/chat')
  }

  return (
    <div className="min-h-screen bg-[#111b21] flex flex-col items-center justify-center p-4 text-white">
      <div className="max-w-4xl w-full text-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
        <div className="flex justify-center flex-col items-center">
          <div className="w-20 h-20 bg-[#00a884] rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-[#00a884]/20 rotate-3 hover:rotate-0 transition-transform">
            <MessageSquare className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-[#e9edef] mb-4 bg-gradient-to-br from-white to-[#8696a0] bg-clip-text text-transparent">
            Connectly
          </h1>
          <p className="text-[#8696a0] text-xl md:text-2xl font-medium max-w-2xl mx-auto leading-relaxed">
            Experience real-time messaging with premium design. Simple, secure, and blazing fast.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mt-12">
          <Link
            href="/login"
            className="group relative px-8 py-4 bg-[#00a884] hover:bg-[#008f6f] text-[#111b21] font-bold rounded-full transition-all duration-300 hover:scale-105 active:scale-95 shadow-lg overflow-hidden shrink-0"
          >
            <span className="relative z-10 flex items-center gap-2">
              Start Chatting Now
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </span>
          </Link>
          <p className="text-[#667781] text-sm sm:text-base border-l border-[#2a3942] pl-4 italic">
            No credit card. No phone number. <br className="hidden sm:block" /> Just your Google account.
          </p>
        </div>

        {/* Feature Icons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-24 pt-12 border-t border-[#2a3942]">
          {[
            { title: 'End-to-End Privacy', desc: 'Secure RLS policies keep your chats private.' },
            { title: 'Real-time Sync', desc: 'Experience no-lag messaging with Supabase Realtime.' },
            { title: 'Media Support', desc: 'Share images, videos, and documents instantly.' }
          ].map((feature, i) => (
            <div key={i} className="space-y-2 group">
              <h3 className="text-[#00a884] font-bold text-lg group-hover:text-[#00c99e] transition-colors">
                {feature.title}
              </h3>
              <p className="text-[#8696a0] text-sm leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
