import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/app/lib/supabaseServer';
import { getPaymentGateway } from '@/app/lib/paymentGateways';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      payment_link_id, 
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = body;

    if (!payment_link_id || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json(
        { success: false, error: 'Missing verification fields' },
        { status: 400 }
      );
    }

    const { data: paymentLink, error } = await supabaseServer
      .from('payment_links')
      .select('id, gateway, link_amount')
      .eq('id', payment_link_id)
      .single();

    if (error || !paymentLink) {
      console.error('Payment link not found:', error);
      return NextResponse.json(
        { success: false, error: 'Payment link not found' },
        { status: 404 }
      );
    }

    const gateway = getPaymentGateway(paymentLink.gateway);

    const result = await gateway.verifyPayment({
      payment_link_id,
      gateway_response: {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
      },
    });

    if (!result.success) {
      console.error('Verification failed:', result.error);
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    const { error: updateError } = await supabaseServer
      .from('payment_links')
      .update({
        status: 'paid',
        gateway_payment_id: result.payment_id,
        paid_at: new Date().toISOString(),
      })
      .eq('id', payment_link_id);

    if (updateError) throw updateError;

    return NextResponse.json({ success: true, payment_id: result.payment_id });
  } catch (error: any) {
    console.error('Payment verification error:', error);
    return NextResponse.json(
      { success: false, error: 'Verification failed' },
      { status: 500 }
    );
  }
}
