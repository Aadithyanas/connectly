import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import webpush from "npm:web-push"

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!;

// The subject should be a mailto: or a website URL
const VAPID_SUBJECT = 'mailto:admin@connectly.app';

webpush.setVapidDetails(
  VAPID_SUBJECT,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

serve(async (req) => {
  try {
    const payload = await req.json();
    const { record, table, type } = payload;

    // Only handle new messages
    if (table !== 'messages' || type !== 'INSERT') {
      return new Response('Ignoring non-insert event', { status: 200 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Find the recipient(s) in this chat (someone who isn't the sender)
    // We fetch participants for the chat associated with the new message
    const { data: participants, error: pError } = await supabase
      .from('chat_participants')
      .select('user_id')
      .eq('chat_id', record.chat_id)
      .neq('user_id', record.sender_id);

    if (pError || !participants || participants.length === 0) {
      console.log('No recipients to notify');
      return new Response('No recipients found', { status: 200 });
    }

    // 2. Fetch all active push subscriptions for these recipients
    const userIds = participants.map(p => p.user_id);
    const { data: subscriptions, error: sError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .in('user_id', userIds);

    if (sError || !subscriptions) {
      throw sError || new Error('Failed to fetch subscriptions');
    }

    // 3. Send notifications to all active subscriptions
    const notificationPayload = JSON.stringify({
      title: 'New Message',
      body: record.content || '📎 Media Attachment',
      url: `/chat?id=${record.chat_id}`
    });

    const pushPromises = subscriptions.map(async (sub) => {
      try {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth
          }
        };
        
        await webpush.sendNotification(pushSubscription, notificationPayload);
        console.log(`Notification sent to endpoint: ${sub.endpoint}`);
      } catch (error) {
        console.error(`Error sending push to ${sub.endpoint}:`, error);
        
        // Optional: Clean up expired subscriptions (410 Gone or 404 Not Found)
        if (error.statusCode === 410 || error.statusCode === 404) {
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('id', sub.id);
          console.log(`Cleaned up expired subscription: ${sub.id}`);
        }
      }
    });

    await Promise.all(pushPromises);

    return new Response(JSON.stringify({ success: true, notifiedCount: subscriptions.length }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });

  } catch (err) {
    console.error('Function error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});
