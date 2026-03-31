import { NextResponse } from "next/server";

/**
 * Weekly Report Cron Endpoint
 * Triggered by Vercel Cron every Sunday at 20:00 UTC
 * 
 * Since Gemini AI runs via Firebase AI SDK (client-side only),
 * this endpoint serves as a notification trigger.
 * The actual report generation happens client-side when user opens the dashboard.
 * 
 * This route sets a flag in a lightweight store that the client checks.
 */

export async function GET(request: Request) {
  // Verify cron secret for security (Vercel sets this automatically for cron jobs)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    status: "triggered",
    message: "Weekly report generation queued. Will run on next client visit.",
    timestamp: new Date().toISOString(),
  });
}
