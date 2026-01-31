import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';

export async function POST(request: NextRequest) {
  console.log('==================== API CALLED ====================');
  
  // 👇 ADD THIS DEBUGGING
  console.log('🔍 ALL ENV VARS:', {
    NEXT_PUBLIC_RAZORPAY_KEY_ID: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET ? '***EXISTS***' : 'MISSING',
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? '***EXISTS***' : 'MISSING',
  });
  
  try {
    const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    
    console.log('🔑 Key ID:', keyId);
    console.log('🔑 Key Secret exists:', !!keySecret);

    if (!keyId || !keySecret) {
      console.error('❌ CREDENTIALS MISSING!');
      console.error('Key ID present:', !!keyId);
      console.error('Key Secret present:', !!keySecret);
      throw new Error('Razorpay credentials not found');
    }

    // ... rest of your code


    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    console.log('✅ Razorpay instance created');

    const { payment_link_id } = await request.json();
    console.log('📦 Payment Link ID:', payment_link_id);

    const receiptId = payment_link_id.slice(0, 40);

    const options = {
      amount: 100,
      currency: 'INR',
      receipt: receiptId,
      notes: {
        payment_link_id: payment_link_id,
      },
    };

    console.log('📤 Creating Razorpay order with options:', JSON.stringify(options, null, 2));
    
    const order = await razorpay.orders.create(options);
    
    console.log('✅ Order created successfully!');
    console.log('📦 Order ID:', order.id);
    console.log('💰 Amount:', order.amount);
    console.log('💱 Currency:', order.currency);
    console.log('📋 Full order object:', JSON.stringify(order, null, 2));

    const response = {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: keyId,
    };

    console.log('📨 Sending response to frontend:', JSON.stringify(response, null, 2));
    return NextResponse.json(response);
    
  } catch (error: any) {
    console.error('❌❌❌ ERROR OCCURRED ❌❌❌');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Full error:', JSON.stringify(error, null, 2));
    
    return NextResponse.json(
      { 
        error: 'Failed to initialize payment',
        details: error.message 
      },
      { status: 500 }
    );
  }
}
