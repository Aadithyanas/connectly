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
      {/* Sidebar and Sidebar components will go here */}
      <div className="flex w-full h-full border border-[#2a3942] m-4 rounded-xl overflow-hidden shadow-2xl bg-[#222e35]/50 backdrop-blur-xl border-opacity-50">
        {children}
      </div>
    </div>
  )
}
