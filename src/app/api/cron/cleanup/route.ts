import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { deleteOldRateLimits, deleteStaleSupportThreads } from "@/lib/dataRetention";

// Vercel Cron から毎日 AM 3:00 (JST) に呼ばれる。Authorization: Bearer $CRON_SECRET で保護
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const now = new Date();
  const deletedThreads = await deleteStaleSupportThreads(supabase, now);
  await deleteOldRateLimits(supabase, now);

  return NextResponse.json({ deletedThreads });
}
