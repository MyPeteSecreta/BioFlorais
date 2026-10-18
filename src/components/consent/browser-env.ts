import type { PixelEnv } from "@/lib/pixel";

/** Ambiente real do navegador para o controlador do pixel (nunca chamar no servidor). */
export function browserPixelEnv(): PixelEnv {
  let storage: Storage | null = null;

  try {
    storage = window.localStorage;
  } catch {
    storage = null;
  }

  return {
    win: window as unknown as PixelEnv["win"],
    doc: document as unknown as PixelEnv["doc"],
    storage,
    hostname: window.location.hostname,
  };
}
