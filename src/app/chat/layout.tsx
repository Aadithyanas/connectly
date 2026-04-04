import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export default async function ChatLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="flex h-screen bg-[#111b21] text-[#e9edef] overflow-hidden selection:bg-[#00a884]/30">
      {/* Main App Container */}
      <div className="flex-1 m-2 sm:m-4 h-[calc(100vh-1rem)] sm:h-[calc(100vh-2rem)] border border-[#2a3942] rounded-xl overflow-hidden shadow-2xl bg-[#222e35]/50 backdrop-blur-xl border-opacity-50 flex flex-col md:flex-row">
        {children}
      </div>
    </div>
  )
}
