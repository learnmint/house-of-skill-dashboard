import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getPaymentGateway } from '../../../lib/paymentGateways';

// Create Supabase client for API route
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('🔍 Verify request body:', body);

    const { 
      payment_link_id, 
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    } = body;

    // Fetch payment link details
    const { data: paymentLink, error } = await supabase
      .from('payment_links')
      .select('id, gateway, link_amount')
      .eq('id', payment_link_id)
      .single();

    if (error || !paymentLink) {
      console.error('❌ Payment link not found:', error);
      return NextResponse.json(
        { success: false, error: 'Payment link not found' },
        { status: 404 }
      );
    }

    console.log('✅ Payment link found:', paymentLink);

    // Get the payment gateway
    const gateway = getPaymentGateway(paymentLink.gateway);

    // Verify payment with gateway-specific response format
    const result = await gateway.verifyPayment({
      payment_link_id,
      gateway_response: {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature
      },
    });

    console.log('🔐 Verification result:', result);

    if (!result.success) {
      console.error('❌ Verification failed:', result.error);
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    // Update payment link status
    const { error: updateError } = await supabase
      .from('payment_links')
      .update({
        status: 'paid',
        gateway_payment_id: result.payment_id,
        paid_at: new Date().toISOString(),
      })
      .eq('id', payment_link_id);

    if (updateError) {
      console.error('❌ Database update error:', updateError);
      throw updateError;
    }

    console.log('✅ Payment verified and saved successfully');

    return NextResponse.json({
      success: true,
      payment_id: result.payment_id,
    });
  } catch (error: any) {
    console.error('❌ Payment verification error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Verification failed' },
      { status: 500 }
    );
  }
}
