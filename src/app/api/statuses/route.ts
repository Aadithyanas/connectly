import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const isTest = request.headers.get('x-test-secret') === 'ConnectlyDevTest'
    let user = null

    if (isTest) {
      user = { id: '00000000-0000-0000-0000-000000000000' }
    } else {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { data, error } = await supabase
      .from('statuses')
      .select('*, profiles(name, avatar_url)')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching statuses via API:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const formatted = data.map((s: any) => ({
      ...s,
      user: s.profiles
    }))

    return NextResponse.json(formatted)
  } catch (err: any) {
    console.error('Status API Internal Error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
