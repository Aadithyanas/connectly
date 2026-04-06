'use client'

import { useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useAuth } from '@/context/AuthContext'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

export function usePushNotifications() {
  const supabase = createClient()
  const { user } = useAuth()

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      return
    }

    const subscribeUser = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js')
        
        // Wait for service worker to be ready
        await navigator.serviceWorker.ready

        const permission = await Notification.requestPermission()
        if (permission !== 'granted') return

        let subscription = await registration.pushManager.getSubscription()
        
        if (!subscription) {
          if (!VAPID_PUBLIC_KEY) {
            console.error('VAPID public key not found in environment variables.')
            return
          }

          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
          })
        }

        if (!user) return

        // Save subscription to the database
        const subJson = subscription.toJSON()
        if (!subJson.endpoint || !subJson.keys?.p256dh || !subJson.keys?.auth) return

        const { error } = await supabase
          .from('push_subscriptions')
          .upsert({
            user_id: user.id,
            endpoint: subJson.endpoint,
            p256dh: subJson.keys.p256dh,
            auth: subJson.keys.auth
          }, { 
            onConflict: 'user_id, endpoint' 
          })

        if (error) console.error('Failed to save push subscription:', error)
        else console.log('Push subscription saved successfully')

      } catch (error) {
        console.error('Error during push subscription:', error)
      }
    }

    subscribeUser()
  }, [user, supabase])
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}
