import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

export async function POST(request: Request) {
  if (!stripeSecretKey) {
    throw new Error("Missing required environment variable: STRIPE_SECRET_KEY");
  }

  const stripe = new Stripe(stripeSecretKey);

  const { amountCents } = await request.json();

  const session = await stripe.checkout.sessions.create({
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
    mode: "payment",
    success_url: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/success`,
  });

  return NextResponse.json({ url: session.url });
}