"use client";

import { OPEN_SETTINGS_EVENT } from "@/lib/consent";

/** "Configurar cookies": reabre as preferências (retirar o consentimento apaga os cookies do pixel). */
export default function CookieSettingsLink({ className }: { className?: string }) {
  return (
    <button type="button" onClick={() => window.dispatchEvent(new Event(OPEN_SETTINGS_EVENT))} className={className}>
      Configurar cookies
    </button>
  );
}
