import { NextRequest, NextResponse } from "next/server";

const keyId = process.env.RAZORPAY_KEY_ID!;
const keySecret = process.env.RAZORPAY_KEY_SECRET!;

// Basic auth header for Razorpay
const authHeader =
  "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64");

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const amount = body.amount ?? body.link_amount ?? body.linkAmount;
    const customer_name =
      body.customer_name || body.customername || body.customerName;
    const customer_email =
      body.customer_email || body.customeremail || body.customerEmail;
    const customer_phone =
      body.customer_phone || body.customerphone || body.customerPhone;
    const description = body.description || body.desc || body.payment_description;

    if (!amount || !customer_name || !customer_phone) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Razorpay amount is in paise (multiply by 100)
    const payload = {
      amount: Math.round(Number(amount) * 100),
      currency: "INR",
      customer: {
        name: customer_name,
        contact: customer_phone,
        email: customer_email || undefined,
      },
      description: description || "Course payment",
      notify: {
        sms: true,
        email: true,
      },
      reminder_enable: true,
      callback_method: "get",
      // You can add callback_url later for tracking
    };

    const res = await fetch(
      "https://api.razorpay.com/v1/payment_links",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
        body: JSON.stringify(payload),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error("Razorpay error:", errText);
      return NextResponse.json(
        { error: "Failed to create Razorpay link", detail: errText },
        { status: 500 }
      );
    }

    const data = await res.json();

    // data.id = payment link id, data.short_url or data.href = URL
    return NextResponse.json(
      {
        id: data.id,
        url: data.short_url || data.href,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: "Server error", detail: err?.message },
      { status: 500 }
    );
  }
}
