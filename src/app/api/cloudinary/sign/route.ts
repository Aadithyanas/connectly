import { NextResponse } from 'next/server'
import { v2 as cloudinary } from 'cloudinary'

// Initialize with environment variables (you will need to add these to .env.local)
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export async function POST(request: Request) {
  try {
    const { folder = 'connectly_uploads' } = await request.json()
    
    // Generate a timestamp
    const timestamp = Math.round((new Date).getTime()/1000)

    // Generate signature locally using the secret
    const signature = cloudinary.utils.api_sign_request({
      timestamp,
      folder,
    }, process.env.CLOUDINARY_API_SECRET as string)

    return NextResponse.json({
      timestamp,
      signature,
      cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY
    })
  } catch (error: any) {
    console.error('Cloudinary signature error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
