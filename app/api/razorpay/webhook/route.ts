import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Using anon key is enough here because RLS is disabled on payment_links.
// Later we can switch to a service role key if needed.
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();

    // Basic logging (you can remove later)
    console.log("Razorpay webhook received:", JSON.stringify(payload));

    const event = payload.event as string;
    const linkEntity = payload.payload?.payment_link?.entity;
    if (!linkEntity) {
      return NextResponse.json({ message: "No payment_link entity" }, { status: 200 });
    }

    const razorpayLinkId = linkEntity.id as string | undefined;
    const statusFromRazorpay = linkEntity.status as string | undefined;
    const paidAmount = linkEntity.amount_paid as number | undefined; // in paise

    if (!razorpayLinkId) {
      return NextResponse.json({ message: "No payment link id" }, { status: 200 });
    }

    // Map Razorpay status / event to our status values
    // See: https://razorpay.com/docs/webhooks/payment-links/ [web:73]
    let appStatus = "payment_pending";

    switch (statusFromRazorpay) {
      case "created":
      case "active":
        appStatus = "payment_pending";
        break;
      case "cancelled":
        appStatus = "payment_failed";
        break;
      case "expired":
        appStatus = "payment_failed";
        break;
      case "paid":
        appStatus = "fully_paid";
        break;
      case "partially_paid":
        appStatus = "partial_paid";
        break;
      default:
        appStatus = "payment_pending";
    }

    const amountPaidInRupees =
      typeof paidAmount === "number" ? paidAmount / 100 : null;

    const { error: updateError } = await supabase
      .from("payment_links")
      .update({
        status: appStatus,
        amount_paid: amountPaidInRupees,
        last_status_update: new Date().toISOString(),
      })
      .eq("gateway_link_id", razorpayLinkId);

    if (updateError) {
      console.error("Failed to update payment_links from webhook:", updateError);
      return NextResponse.json(
        { error: "DB update failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err: any) {
    console.error("Webhook handler error:", err);
    return NextResponse.json(
      { error: "Server error", detail: err?.message },
      { status: 500 }
    );
  }
}
