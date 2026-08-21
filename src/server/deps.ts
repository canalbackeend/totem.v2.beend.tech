import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { createHash } from "node:crypto";

dotenv.config();

export const PORT = 3000;

export const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
export const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || "";
export const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

// Validate Environment Variables (Optional for local testing)
if (!process.env.DATABASE_URL && process.env.NODE_ENV === "production") {
  console.warn("WARNING: DATABASE_URL environment variable is missing for production.");
}

export const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("FATAL: JWT_SECRET environment variable is required. Set a strong secret key.");
  process.exit(1);
}

export const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "adm@beend.tech";
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (!ADMIN_PASSWORD) {
  console.error("FATAL: ADMIN_PASSWORD environment variable is required. Set a strong password for the admin account.");
  process.exit(1);
}
// Never fall back to ADMIN_PASSWORD: the reset secret must be independent.
// Derive from JWT_SECRET (already required/strong) so it stays stable across restarts.
export const ADMIN_RESET_SECRET =
  process.env.ADMIN_RESET_SECRET || createHash("sha256").update(`${JWT_SECRET}:beend-admin-reset`).digest("hex");

export const prisma = new PrismaClient();

// Limitadores de requisições (rate limiting) por endpoint:
// - authLimiter: 10 tentativas / 15min (login e registro).
// - apiLimiter: 120 requisições / min para toda a API (exceto health check).
// - publicResponseLimiter: 60 envios / min para o endpoint público de respostas.
export const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: { error: "Muitas tentativas. Tente novamente mais tarde." } });
export const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 120, skip: (req) => req.path.startsWith("/api/health"), message: { error: "Muitas requisições. Tente novamente mais tarde." } });
export const publicResponseLimiter = rateLimit({ windowMs: 60 * 1000, max: 60, message: { error: "Muitas requisições. Tente novamente mais tarde." } });

// Filtra um objeto, mantendo apenas as chaves permitidas (anti mass-assignment).
// Campos com valor `undefined` são ignorados.
export function whitelist(obj: any, allowed: string[]) {
  const safe: any = {};
  for (const key of allowed) {
    if (obj[key] !== undefined) safe[key] = obj[key];
  }
  return safe;
}

// Remove campos sensíveis (ex.: senha) antes de enviar objetos ao cliente.
export function publicUser(user: any) {
  if (!user) return user;
  const { password, ...safe } = user;
  return safe;
}

export function publicTerminal(terminal: any) {
  if (!terminal) return terminal;
  const { password, ...safe } = terminal;
  return safe;
}

export function publicCompany(company: any) {
  if (!company) return company;
  const { password, ...safe } = company;
  return safe;
}

// Parse do campo terminal.campaigns, que pode ser armazenado como CSV
// (ex.: "Campanha A,Campanha B") ou como JSON array (ex.: '["A","B"]').
export function parseCampaignList(value: any): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter((c: any) => typeof c === "string");
  if (typeof value !== "string") return [];
  const trimmed = value.trim();
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.filter((c: any) => typeof c === "string");
    } catch {
      // Se o JSON for inválido, cai no parsing por vírgula.
    }
  }
  return trimmed.split(",").map((c: string) => c.trim()).filter(Boolean);
}

// Mensagem padrão para contas/terminais bloqueados. Reutilizada no login,
// no envio de respostas e no middleware de autenticação.
export const BLOCKED_ACCOUNT_ERROR = { error: "Conta bloqueada, impossível sincronizar os dados." };

// Converte uma Date (ou string de data) em "YYYY-MM-DD" (formato de chave de dia).
export function toISODate(date: Date | string): string {
  return new Date(date).toISOString().split("T")[0];
}

// Auth Middleware — re-validates the user against the DB so blocked/deleted
// accounts lose access immediately (instead of waiting for token expiry).
export const authenticateToken = async (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, async (err: any, user: any) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    req.user.isTerminal = !!user.terminal_id || !!user.isTerminal;

    // Terminal tokens carry the owner's user_id in `id`, so this lookup covers
    // both user tokens and terminal tokens.
    try {
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { status: true },
      });
      if (!dbUser || dbUser.status !== "Ativo") {
        return res.status(403).json(BLOCKED_ACCOUNT_ERROR);
      }
    } catch {
      // Fail-open on DB errors: the JWT is still valid; do not break the app.
    }
    next();
  });
};

// Master admin check. Terminals must never match, even if they hold the admin email.
export function isMasterAdmin(req: any): boolean {
  return !req.user?.isTerminal && req.user?.email === ADMIN_EMAIL;
}