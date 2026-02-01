import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseServer } from '@/app/lib/supabaseServer';

const EVENT_TYPE_MAP: Record<string, string> = {
  'payment.authorized': 'payment_authorized',
  'payment.captured': 'payment_captured',
  'payment.failed': 'payment_failed',
  'order.paid': 'order_paid',
  'payment.pending': 'payment_pending',
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get('x-razorpay-signature');

    if (!signature) {
      return NextResponse.json({ error: 'No signature' }, { status: 400 });
    }

    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || '';
    if (!webhookSecret) {
      console.error('RAZORPAY_WEBHOOK_SECRET not configured');
      return NextResponse.json(
        { error: 'Webhook not configured' },
        { status: 500 }
      );
    }

    // Verify signature
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(body)
      .digest('hex');

    if (signature !== expectedSignature) {
      console.error('Invalid Razorpay webhook signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const event = JSON.parse(body);
    console.log('Razorpay webhook event:', event.event);

    const paymentEntity = event.payload?.payment?.entity;
    const orderEntity = event.payload?.order?.entity;

    const paymentLinkId =
      paymentEntity?.notes?.payment_link_id ||
      orderEntity?.notes?.payment_link_id;

    if (!paymentLinkId) {
      console.log('No payment_link_id in webhook notes');
      return NextResponse.json({ received: true });
    }

    const mappedType = EVENT_TYPE_MAP[event.event] || event.event;

    const rawAmount = paymentEntity?.amount;
    const amount = typeof rawAmount === 'number' ? rawAmount / 100 : null;

    const eventData: any = {
      razorpay_payment_id: paymentEntity?.id,
      razorpay_order_id: paymentEntity?.order_id || orderEntity?.id,
      amount,
      method: paymentEntity?.method,
      status: paymentEntity?.status,
      error_code: paymentEntity?.error_code,
      error_description: paymentEntity?.error_description,
      error_reason: paymentEntity?.error_reason,
      vpa: paymentEntity?.vpa,
      card_network: paymentEntity?.card?.network,
      bank: paymentEntity?.bank,
      wallet: paymentEntity?.wallet,
      emi_duration: paymentEntity?.emi_duration,
    };

    const { error: insertError } = await supabaseServer
      .from('payment_events')
      .insert({
        payment_link_id: paymentLinkId,
        event_type: mappedType,
        event_data: eventData,
        razorpay_event_id: paymentEntity?.id || orderEntity?.id,
      });

    if (insertError) {
      console.error('Error inserting payment event:', insertError);
    }

    // Update payment_links status
    if (event.event === 'payment.captured' || event.event === 'order.paid') {
      if (amount !== null) {
        const { data: paymentLink, error: linkError } = await supabaseServer
          .from('payment_links')
          .select('pitched_amount, link_amount')
          .eq('id', paymentLinkId)
          .single();

        if (!linkError && paymentLink) {
          const pitchedAmount = paymentLink.pitched_amount || 0;
          const paidAmount = amount;
          const balanceAmount = Math.max(pitchedAmount - paidAmount, 0);

          let newStatus = 'paid';
          if (balanceAmount > 0) newStatus = 'partial_paid';

          await supabaseServer
            .from('payment_links')
            .update({
              status: newStatus,
              balance_amount: balanceAmount,
            })
            .eq('id', paymentLinkId);
        } else {
          console.error('Error fetching payment_link for webhook:', linkError);
        }
      }
    } else if (event.event === 'payment.failed') {
      await supabaseServer
        .from('payment_links')
        .update({ status: 'failed' })
        .eq('id', paymentLinkId);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed', details: error.message },
      { status: 500 }
    );
  }
}
