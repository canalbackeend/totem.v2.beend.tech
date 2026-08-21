import { prisma } from "./deps";

const DOMAIN = "be.end";

export function randomDigits(length: number): string {
  let digits = "";
  for (let i = 0; i < length; i++) {
    digits += Math.floor(Math.random() * 10).toString();
  }
  return digits;
}

// Monta o e-mail automático de um terminal no formato "ter-XXXXX-YYY@be.end",
// onde `middleSegment` e `suffix` são trechos de dígitos aleatórios.
export function buildTerminalEmail(middleSegment: string, suffix: string): string {
  return `ter-${middleSegment}-${suffix}@${DOMAIN}`;
}

export function normalizeEmail(email: string): string {
  return (email || "").trim().toLowerCase().replace(/\s+/g, "");
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function generateAutoEmail(): string {
  return buildTerminalEmail(randomDigits(5), randomDigits(3));
}

export async function emailInUse(email: string, excludeId?: string): Promise<boolean> {
  const count = await prisma.terminal.count({
    where: {
      email,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  });
  return count > 0;
}

export async function generateUniqueTerminalEmail(maxAttempts = 30): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const candidate = generateAutoEmail();
    if (!(await emailInUse(candidate))) return candidate;
  }
  throw new Error("Não foi possível gerar um e-mail único para o terminal. Tente novamente.");
}