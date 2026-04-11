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
      chat_id,
      content,
      media_url,
      media_type,
      reply_to,
      client_id,
      forwarded
    } = body

    if (!chat_id) {
      return NextResponse.json({ error: 'Chat ID is required' }, { status: 400 })
    }

    // 3. Insert into database
    // Running this in the API route protects direct database writes from the client
    const { data: message, error: insertError } = await supabase
      .from('messages')
      .insert({
        chat_id,
        sender_id: user.id, // Enforce sender_id from auth token on the server
        content,
        media_url,
        media_type,
        status: 'sent',
        reply_to,
        client_id,
        forwarded: !!forwarded,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Insert error in API route:', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ message })
  } catch (error: any) {
    console.error('API Send Message Error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
