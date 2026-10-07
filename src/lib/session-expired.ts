export const SESSION_EXPIRED_MESSAGE = "Sua sessão expirou. Entre de novo.";

/** Só as chamadas autenticadas da própria área contam; o login pode dar 401 por senha errada. */
export function isSessionApiCall(scope: "admin" | "b2b", path: string) {
  if (scope === "admin") return path.startsWith("/api/admin/") && !path.startsWith("/api/admin/login");

  return path.startsWith("/api/b2b/") && !path.startsWith("/api/b2b/auth/");
}
