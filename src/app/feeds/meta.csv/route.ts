/** GET /feeds/meta.csv — feed de produtos para o catálogo da Meta (Commerce Manager). */

import { renderMetaFeedCsv } from "@/lib/feeds/products";
import { loadFeedItems } from "@/lib/feeds/items.server";

export const dynamic = "force-static";
export const revalidate = 3600;

export function GET() {
  return new Response(renderMetaFeedCsv(loadFeedItems()), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Cache-Control": "public, max-age=900, s-maxage=3600" },
  });
}
