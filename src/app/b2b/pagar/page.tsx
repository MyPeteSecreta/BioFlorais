import { Suspense } from "react";

import PayLinkContent from "./PayLinkContent";

export const metadata = { title: "Bio Florais | Pagamento do pedido", robots: { index: false, follow: false } };

export default function PayLinkPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#fffaf6]" />}>
      <PayLinkContent />
    </Suspense>
  );
}
