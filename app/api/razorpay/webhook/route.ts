import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get('x-razorpay-signature');

    if (!signature) {
      return NextResponse.json({ error: 'No signature' }, { status: 400 });
    }

    // Verify webhook signature
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || '';
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(body)
      .digest('hex');

    if (signature !== expectedSignature) {
      console.error('❌ Invalid webhook signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const event = JSON.parse(body);
    console.log('✅ Razorpay Webhook Event:', event.event);

    // Extract payment link ID from order notes
    const paymentLinkId = event.payload?.payment?.entity?.notes?.payment_link_id ||
                          event.payload?.order?.entity?.notes?.payment_link_id;

    if (!paymentLinkId) {
      console.log('⚠️ No payment_link_id in webhook');
      return NextResponse.json({ received: true });
    }

    // Map Razorpay events to our event types
    const eventTypeMap: { [key: string]: string } = {
      'payment.authorized': 'payment_authorized',
      'payment.captured': 'payment_captured',
      'payment.failed': 'payment_failed',
      'order.paid': 'order_paid',
      'payment.pending': 'payment_pending',
    };

    const eventType = eventTypeMap[event.event] || event.event;

    // Extract useful data
    const eventData: any = {
      razorpay_payment_id: event.payload?.payment?.entity?.id,
      razorpay_order_id: event.payload?.payment?.entity?.order_id || event.payload?.order?.entity?.id,
      amount: event.payload?.payment?.entity?.amount / 100, // Convert from paise
      method: event.payload?.payment?.entity?.method, // upi, card, netbanking, wallet, emi
      status: event.payload?.payment?.entity?.status,
      error_code: event.payload?.payment?.entity?.error_code,
      error_description: event.payload?.payment?.entity?.error_description,
      error_reason: event.payload?.payment?.entity?.error_reason,
      vpa: event.payload?.payment?.entity?.vpa, // UPI ID
      card_network: event.payload?.payment?.entity?.card?.network, // Visa, Mastercard, etc.
      bank: event.payload?.payment?.entity?.bank,
      wallet: event.payload?.payment?.entity?.wallet,
      emi_duration: event.payload?.payment?.entity?.emi_duration,
    };

    // Insert event into database
    const { error: insertError } = await supabase
      .from('payment_events')
      .insert({
        payment_link_id: paymentLinkId,
        event_type: eventType,
        event_data: eventData,
        razorpay_event_id: event.payload?.payment?.entity?.id || event.payload?.order?.entity?.id,
      });

    if (insertError) {
      console.error('❌ Error inserting payment event:', insertError);
    }

    // Update payment_links table based on event
    if (event.event === 'payment.captured' || event.event === 'order.paid') {
      const amount = event.payload?.payment?.entity?.amount / 100;
      
      // Get current payment link
      const { data: paymentLink } = await supabase
        .from('payment_links')
        .select('pitched_amount, link_amount')
        .eq('id', paymentLinkId)
        .single();

      if (paymentLink) {
        const pitchedAmount = paymentLink.pitched_amount || 0;
        const paidAmount = amount;
        const balanceAmount = Math.max(pitchedAmount - paidAmount, 0);

        let newStatus = 'paid';
        if (balanceAmount > 0) {
          newStatus = 'partial_paid';
        }

        await supabase
          .from('payment_links')
          .update({
            status: newStatus,
            balance_amount: balanceAmount,
          })
          .eq('id', paymentLinkId);
      }
    } else if (event.event === 'payment.failed') {
      await supabase
        .from('payment_links')
        .update({ status: 'failed' })
        .eq('id', paymentLinkId);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('❌ Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed', details: error.message },
      { status: 500 }
    );
  }
}
