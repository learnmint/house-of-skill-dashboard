import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    razorpay_key_id_exists: !!process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    razorpay_key_id_value: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID?.slice(0, 10) + '...',
    razorpay_secret_exists: !!process.env.RAZORPAY_KEY_SECRET,
  });
}
