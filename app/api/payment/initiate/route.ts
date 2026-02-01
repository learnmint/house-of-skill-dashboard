import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { supabaseServer } from '@/app/lib/supabaseServer';

export async function POST(request: NextRequest) {
  console.log('=== /api/payment/initiate called ===');

  try {
    const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      console.error('Razorpay credentials missing');
      return NextResponse.json(
        { error: 'Payment gateway not configured' },
        { status: 500 }
      );
    }

    const { payment_link_id } = await request.json();

    if (!payment_link_id) {
      return NextResponse.json(
        { error: 'payment_link_id is required' },
        { status: 400 }
      );
    }

    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });

    const { data: paymentLink, error: linkError } = await supabaseServer
      .from('payment_links')
      .select('id, link_amount, customer_name, customer_phone, customer_email')
      .eq('id', payment_link_id)
      .single();

    if (linkError || !paymentLink) {
      console.error('Payment link not found:', linkError);
      return NextResponse.json(
        { error: 'Payment link not found' },
        { status: 404 }
      );
    }

    const receiptId = payment_link_id.slice(0, 40);

    const options = {
      amount: Math.round(paymentLink.link_amount * 100),
      currency: 'INR',
      receipt: receiptId,
      notes: {
        payment_link_id,
        customer_name: paymentLink.customer_name,
        customer_phone: paymentLink.customer_phone,
        customer_email: paymentLink.customer_email,
      },
    };

    console.log('Creating Razorpay order with:', options);

    const order = await razorpay.orders.create(options);

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId,
    });
  } catch (error: any) {
    console.error('Initiate error:', error);
    return NextResponse.json(
      { error: 'Failed to initialize payment' },
      { status: 500 }
    );
  }
}
