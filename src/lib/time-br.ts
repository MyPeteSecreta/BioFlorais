/**
 * Hora de Brasília (America/Sao_Paulo) em tudo que o admin mostra ou filtra por dia.
 * `orders.created_at` é `timestamp` SEM fuso e o banco grava em UTC (now() do Neon). O Drizzle devolve o instante certo, mas formatar
 * sem `timeZone` usa o fuso do servidor (UTC na Vercel): 23:30 de Brasília aparecia como 02:30 do dia seguinte. Nada do que está
 * gravado muda; só a exibição e o corte de dia.
 */

export const TIME_ZONE_BR = "America/Sao_Paulo";

const toDate = (value: Date | string | number | null | undefined): Date | null => {
  if (value === null || value === undefined || value === "") return null;

  // texto de `timestamp` sem fuso vindo do banco ("2026-11-25 02:30:00" ou ...T02:30:00) é UTC
  const date = typeof value === "string" && !/(Z|[+-]\d{2}:?\d{2})$/.test(value.trim()) ? new Date(`${value.trim().replace(" ", "T")}Z`) : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
};

/** Dia de hoje em Brasília, AAAA-MM-DD. */
export function todayBR(now: Date | number = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE_BR, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** "AAAA-MM-DD HH:mm:ss" em Brasília (para CSV); vazio se não houver data. */
export function formatCsvDateTimeBR(value: Date | string | number | null | undefined): string {
  const date = toDate(value);

  if (!date) return "";

  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE_BR, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" })
      .formatToParts(date)
      .map((part) => [part.type, part.value])
  );

  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

/** "dd/mm/aaaa HH:mm" em Brasília (telas). */
export function formatDateTimeBR(value: Date | string | number | null | undefined): string {
  const date = toDate(value);

  return date ? new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE_BR, dateStyle: "short", timeStyle: "short" }).format(date) : "—";
}

/**
 * Expressão SQL: a hora de Brasília (sem fuso) de uma coluna `timestamp` gravada em UTC. Comparar o dia de Brasília:
 *   WHERE <expr> >= $1::date AND <expr> < ($2::date + 1)
 */
export const localTimestampSql = (column: string) => `((${column} AT TIME ZONE 'UTC') AT TIME ZONE '${TIME_ZONE_BR}')`;
