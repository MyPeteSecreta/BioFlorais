"use client";

import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

import { sanitizeAnalyticsUrl } from "@/lib/analytics-url";

/* Web Analytics + Speed Insights da Vercel (sem cookies, sem dado pessoal). Tokens saem da URL antes do envio. */
export default function WebAnalytics() {
  return (
    <>
      <Analytics beforeSend={(event) => ({ ...event, url: sanitizeAnalyticsUrl(event.url) })} />
      <SpeedInsights beforeSend={(event) => ({ ...event, url: sanitizeAnalyticsUrl(event.url) })} />
    </>
  );
}
