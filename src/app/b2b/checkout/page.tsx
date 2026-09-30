import { Suspense } from "react";

import B2BCheckoutContent from "./B2BCheckoutContent";

export default function B2BCheckoutPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#fffaf6]" />}>
      <B2BCheckoutContent />
    </Suspense>
  );
}
