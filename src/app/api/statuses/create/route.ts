import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // 1. Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Parse payload
    const body = await request.json()
    const {
      content_url,
      content_type,
      caption
    } = body

    if (!content_url) {
      return NextResponse.json({ error: 'Content URL is required' }, { status: 400 })
    }

    // 3. Insert into database
    const { data: status, error: insertError } = await supabase
      .from('statuses')
      .insert([{
        user_id: user.id, // Enforce sender_id from auth token on the server
        content_url,
        content_type,
        caption
      }])
      .select()
      .single()

    if (insertError) {
      console.error('Insert error in API route:', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ status })
  } catch (error: any) {
    console.error('API Create Status Error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
