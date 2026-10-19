import { NextResponse } from "next/server";

export async function POST() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return NextResponse.json({ error: "Razorpay is not configured." }, { status: 503 });
  try {
    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST", headers: { Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`, "Content-Type": "application/json" },
      body: JSON.stringify({ amount: 7900, currency: "INR", receipt: `photo-${crypto.randomUUID()}`, notes: { product: "passport-photo-download" } }),
      cache: "no-store",
    });
    const order = await response.json();
    if (!response.ok) return NextResponse.json({ error: "Could not create a payment order." }, { status: 502 });
    return NextResponse.json({ id: order.id, amount: order.amount, currency: order.currency });
  } catch { return NextResponse.json({ error: "Payment service is unavailable." }, { status: 502 }); }
}
