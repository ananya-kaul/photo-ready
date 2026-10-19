import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

export function validSignature(orderId: string, paymentId: string, signature: string, secret: string) {
  const expected = createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
  const left = Buffer.from(expected); const right = Buffer.from(signature);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function POST(request: NextRequest) {
  const keyId = process.env.RAZORPAY_KEY_ID; const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !secret) return NextResponse.json({ error: "Razorpay is not configured." }, { status: 503 });
  let body: { razorpay_order_id?: string; razorpay_payment_id?: string; razorpay_signature?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = body;
  if (!orderId || !paymentId || !signature || !validSignature(orderId, paymentId, signature, secret)) return NextResponse.json({ error: "Payment signature is invalid." }, { status: 400 });
  try {
    const auth = `Basic ${Buffer.from(`${keyId}:${secret}`).toString("base64")}`;
    const [paymentResponse, orderResponse] = await Promise.all([
      fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, { headers: { Authorization: auth }, cache: "no-store" }),
      fetch(`https://api.razorpay.com/v1/orders/${encodeURIComponent(orderId)}`, { headers: { Authorization: auth }, cache: "no-store" }),
    ]);
    if (!paymentResponse.ok || !orderResponse.ok) return NextResponse.json({ error: "Could not verify payment status." }, { status: 502 });
    const [payment, order] = await Promise.all([paymentResponse.json(), orderResponse.json()]);
    if (payment.order_id !== orderId || order.amount !== 7900 || payment.amount !== 7900 || payment.currency !== "INR" || payment.status !== "captured") return NextResponse.json({ error: "Payment is not captured for this order." }, { status: 402 });
    return NextResponse.json({ verified: true });
  } catch { return NextResponse.json({ error: "Payment verification service is unavailable." }, { status: 502 }); }
}
