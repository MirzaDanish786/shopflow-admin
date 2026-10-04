import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const BASE_DELAY_MS = 500;

interface AttemptRecord {
  count: number;
  firstAttempt: number;
}

const attemptsByKey = new Map<string, AttemptRecord>();

function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return "unknown";
}

function checkRateLimit(key: string): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  const record = attemptsByKey.get(key);

  if (!record || now - record.firstAttempt > WINDOW_MS) {
    attemptsByKey.set(key, { count: 1, firstAttempt: now });
    return { allowed: true, retryAfterMs: 0 };
  }

  record.count += 1;

  if (record.count > MAX_ATTEMPTS) {
    const retryAfterMs = record.firstAttempt + WINDOW_MS - now;
    return { allowed: false, retryAfterMs };
  }

  return { allowed: true, retryAfterMs: 0 };
}

export async function POST(request: Request) {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: "Not configured" }, { status: 503 });

  const { email, password } = await request.json();

  const ip = getClientIp(request);
  const emailKey = `email:${String(email).toLowerCase()}`;
  const ipKey = `ip:${ip}`;

  const emailLimit = checkRateLimit(emailKey);
  const ipLimit = checkRateLimit(ipKey);

  if (!emailLimit.allowed || !ipLimit.allowed) {
    const retryAfterMs = Math.max(emailLimit.retryAfterMs, ipLimit.retryAfterMs);
    return NextResponse.json(
      { error: "Too many attempts. Please try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) },
      },
    );
  }

  const emailRecord = attemptsByKey.get(emailKey);
  const attemptNumber = emailRecord ? emailRecord.count : 1;
  if (attemptNumber > 1) {
    const delayMs = Math.min(BASE_DELAY_MS * 2 ** (attemptNumber - 2), 8000);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  const { data, error } = await supabase
    .from("customers")
    .select("id, email, full_name")
    .eq("email", email)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "No such account" }, { status: 401 });
  }

  if (password !== "shopflow") {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }

  return NextResponse.json({ user: data });
}
