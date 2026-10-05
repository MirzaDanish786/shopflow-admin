import { NextResponse } from "next/server";
import Stripe from "stripe";

function getStripe(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("Missing required environment variable: STRIPE_SECRET_KEY");
  }
  return new Stripe(secretKey);
}

export async function POST(request: Request) {
  const { amountCents } = await request.json();

  if (typeof amountCents !== "number" || amountCents <= 0) {
    return NextResponse.json({ error: "Invalid amountCents" }, { status: 400 });
  }

  const stripe = getStripe();

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: { name: "ShopFlow order" },
          unit_amount: amountCents,
        },
        quantity: 1,
      },
    ],
    success_url: `${new URL(request.url).origin}/success`,
  });

  return NextResponse.json({ url: session.url });
}