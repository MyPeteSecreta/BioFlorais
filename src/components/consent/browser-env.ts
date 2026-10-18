import type { OppRefEnv } from "@/lib/ads-tag";

/** Ambiente real do navegador para a captura do oppref (nunca chamar no servidor). */
export function browserOppRefEnv(): OppRefEnv {
  let storage: Storage | null = null;
  let session: Storage | null = null;

  try {
    storage = window.localStorage;
  } catch {
    storage = null;
  }

  try {
    session = window.sessionStorage;
  } catch {
    session = null;
  }

  return {
    search: window.location.search,
    storage,
    session,
    doc: document,
    secure: window.location.protocol === "https:",
  };
}
