import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";

const TRIAL_LENGTH_DAYS = 7;

function trialDayNumber(periodEndIso: string | null): number | null {
  if (!periodEndIso) return null;
  const end = new Date(periodEndIso);
  if (Number.isNaN(end.getTime())) return null;
  const start = new Date(end.getTime() - TRIAL_LENGTH_DAYS * 24 * 60 * 60 * 1000);
  const day = Math.floor((Date.now() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  if (day < 1 || day > TRIAL_LENGTH_DAYS) return null;
  return day;
}

export async function GET() {
  const profile = await getProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isTrialing = profile.subscription_status === "trialing";
  const trialDay = isTrialing
    ? trialDayNumber(profile.subscription_current_period_end)
    : null;
  const daysLeft =
    trialDay != null ? Math.max(0, TRIAL_LENGTH_DAYS - trialDay) : null;

  return NextResponse.json({
    isTrialing,
    trialDay,
    daysLeft,
    showNudge: isTrialing && trialDay != null && trialDay >= 3,
  });
}
