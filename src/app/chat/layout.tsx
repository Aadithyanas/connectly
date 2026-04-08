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

  // Server-side onboarding guard — redirect to onboarding if role not yet set
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile?.role) {
    redirect('/onboarding')
  }

  return (
    <div className="h-dvh bg-black text-white overflow-hidden selection:bg-white/20 flex flex-col">
      {/* Main App Container */}
      <div className="flex-1 m-1.5 sm:m-3 border border-white/[0.06] rounded-xl overflow-hidden shadow-2xl bg-[#0a0a0a] flex overflow-hidden">
        {children}
      </div>
    </div>
  )
}
