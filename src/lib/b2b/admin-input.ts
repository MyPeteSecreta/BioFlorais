/**
 * BIO FLORAIS B2B — validação dos formulários do admin (puro, sem banco).
 * Testado em scripts/b2b-admin-input.test.mjs.
 */

export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function isValidSlug(value: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 80;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

/** Lista de UUIDs únicos; null se algum item não for UUID. */
export function parseUuidList(value: unknown): string[] | null {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) return null;
  if (!value.every(isUuid)) return null;
  return Array.from(new Set(value.map((item) => item.toLowerCase())));
}

export function parseInteger(value: unknown, { min, max }: { min: number; max: number }) {
  const number = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  return typeof number === "number" && Number.isInteger(number) && number >= min && number <= max
    ? number
    : null;
}

/**
 * "AAAA-MM-DD" (input date) -> instante no fuso de São Paulo (UTC-3, sem
 * horário de verão desde 2019). Início = 00:00:00; fim = 23:59:59.999.
 * Vazio -> null (sem limite). Inválido -> undefined.
 */
export function parseSaoPauloDate(
  value: unknown,
  edge: "start" | "end"
): Date | null | undefined {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;

  // Rejeita datas inexistentes (ex.: 2026-02-31), que o JS "corrigiria".
  const [year, month, day] = value.split("-").map(Number);
  const check = new Date(Date.UTC(year, month - 1, day));

  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return undefined;
  }

  const time = edge === "start" ? "T00:00:00.000-03:00" : "T23:59:59.999-03:00";
  return new Date(`${value}${time}`);
}

/** Instante -> "AAAA-MM-DD" no calendário de São Paulo (para o input date). */
export function toSaoPauloDateInput(value: Date | string | null | undefined) {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
