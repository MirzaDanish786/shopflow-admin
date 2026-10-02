import { getSupabase } from "@/lib/supabase";

export interface Order {
  id: string;
  customer_id: string;
  total_cents: number;
  status: string;
  stripe_session_id: string | null;
  created_at: string;
}

export async function listOrders(): Promise<Order[] | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return null;
  }

  return data as Order[];
}
