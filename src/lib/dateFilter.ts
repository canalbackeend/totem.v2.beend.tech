import { useEffect, useState } from 'react';
import { validateDateRange, MAX_FILTER_RANGE_DAYS } from '../server/date-range';

// Mesma regra do backend: o front avisa o usuário e nem dispara a requisição.
export { validateDateRange, MAX_FILTER_RANGE_DAYS };

// Limites do <input type="date">: impedem anos absurdos pelo seletor.
export const DATE_INPUT_MIN = '2000-01-01';

// "YYYY-MM-DD" no fuso local do navegador (toISOString usa UTC e, à noite no
// Brasil, já retornaria o dia seguinte).
export function toLocalISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Atalho "Últimos N dias", contando hoje: N dias no total.
export function quickRange(days: number): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (days - 1));
  return { start: toLocalISODate(start), end: toLocalISODate(end) };
}

// O <input type="date"> emite um valor a cada dígito do ano (0002, 0020, 0202...).
// Esperar o usuário parar de digitar evita uma rajada de requisições.
export function useDebouncedValue<T>(value: T, delayMs = 400): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
