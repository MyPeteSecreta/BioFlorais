/** GET /feeds/google.xml — feed de produtos para o Google Merchant Center (RSS 2.0 com o namespace g:). */

import { renderGoogleFeedXml } from "@/lib/feeds/products";
import { loadFeedItems } from "@/lib/feeds/items.server";
import { getSiteUrl } from "@/lib/seo/site-url";

export const dynamic = "force-static";
export const revalidate = 3600;

export function GET() {
  return new Response(renderGoogleFeedXml(loadFeedItems(), getSiteUrl()), {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=900, s-maxage=3600" },
  });
}
