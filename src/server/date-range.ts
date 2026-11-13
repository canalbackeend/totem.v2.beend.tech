// Validação dos filtros de data (startDate/endDate) vindos da query string.
//
// Incidente: o <input type="date"> do Chrome emite o ano parcial enquanto o
// cliente digita (0002-…, 0020-…, 0202-…). Sem limite, o endpoint de evolução
// criava um bucket por dia — 739 mil dias para 0002-11-01 — e bloqueava o event
// loop por ~70s, derrubando o servidor para todos. Por isso o intervalo é
// limitado e as datas precisam ser completas e plausíveis.

export const MAX_FILTER_RANGE_DAYS = 120;
const MIN_YEAR = 2000;
const MAX_YEAR = 2100;
const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const brtDayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

// Converte "YYYY-MM-DD" num número de dia (UTC à meia-noite) ou null se inválida.
function parseDay(value: string): number | null {
  const match = DATE_PATTERN.exec(value);
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  if (year < MIN_YEAR || year > MAX_YEAR) return null;
  const time = Date.UTC(year, month - 1, day);
  const check = new Date(time);
  // Rejeita datas que o JS "corrige" sozinho (ex.: 2026-02-30 → 2026-03-02).
  if (check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  return time;
}

/**
 * Valida o par startDate/endDate de um filtro.
 * Retorna `null` quando válido, ou a mensagem de erro (para responder 400).
 * Só com startDate, o intervalo é medido até hoje (fuso de Brasília).
 */
export function validateDateRange(startDate: unknown, endDate: unknown): string | null {
  const hasStart = startDate !== undefined && startDate !== "";
  const hasEnd = endDate !== undefined && endDate !== "";
  if (!hasStart && !hasEnd) return null;

  if ((hasStart && typeof startDate !== "string") || (hasEnd && typeof endDate !== "string")) {
    return "Filtro de data inválido.";
  }

  const start = hasStart ? parseDay(startDate as string) : null;
  const end = hasEnd ? parseDay(endDate as string) : null;
  if (hasStart && start === null) return "Data inicial inválida. Use o formato AAAA-MM-DD.";
  if (hasEnd && end === null) return "Data final inválida. Use o formato AAAA-MM-DD.";

  // Sem data inicial não há intervalo aberto para trás a validar.
  if (start === null) return null;

  const effectiveEnd = end ?? parseDay(brtDayFormatter.format(new Date()))!;
  if (start > effectiveEnd) return "A data inicial deve ser anterior ou igual à data final.";

  const days = Math.round((effectiveEnd - start) / DAY_MS) + 1;
  if (days > MAX_FILTER_RANGE_DAYS) {
    return `O intervalo máximo do filtro é de ${MAX_FILTER_RANGE_DAYS} dias.`;
  }
  return null;
}
