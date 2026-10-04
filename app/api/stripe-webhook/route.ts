import { NextResponse } from "next/server";
import crypto from "crypto";
import { getSupabase } from "@/lib/supabase";

function verifyStripeSignature(
  payload: string,
  signatureHeader: string | null,
  secret: string,
): boolean {
  if (!signatureHeader) return false;

  const parts = Object.fromEntries(
    signatureHeader.split(",").map((part) => part.split("=") as [string, string]),
  );
  const timestamp = parts["t"];
  const signature = parts["v1"];
  if (!timestamp || !signature) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error("Missing required environment variable: STRIPE_WEBHOOK_SECRET");
  }

  const rawBody = await request.text();
  const signatureHeader = request.headers.get("stripe-signature");

  if (!verifyStripeSignature(rawBody, signatureHeader, webhookSecret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ received: true });

  const event = JSON.parse(rawBody);

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    await supabase
      .from("orders")
      .update({ status: "paid" })
      .eq("stripe_session_id", session.id);
  }

  return NextResponse.json({ received: true });
}
