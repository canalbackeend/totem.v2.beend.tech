import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { createHash } from "node:crypto";

dotenv.config();

export const PORT = 3000;

export const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";

// Chave "anon" (pública) - usada apenas como fallback. O backend deve preferir
// a chave de serviço (service_role), que bypassa RLS e é segura no servidor.
export const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || "";
export const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";
export const supabaseStorageBucket = process.env.SUPABASE_STORAGE_BUCKET || "uploads";

export const supabaseKey = supabaseServiceKey || supabaseAnonKey;
export const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })
  : null;

if (!supabaseUrl) {
  console.warn("AVISO: SUPABASE_URL não definido; upload de imagens (Supabase Storage) estará desativado.");
} else if (!supabaseServiceKey) {
  console.warn(
    "AVISO: SUPABASE_SERVICE_ROLE_KEY não definido; usando chave anon. Uploads dependem das policies de RLS do bucket. Recomendado definir a chave de serviço no backend.",
  );
}

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
// - authLimiter: falhas de login/registro por IP + e-mail (padrão: 20 / 15min).
// - authIpLimiter: falhas de login/registro por IP (padrão: 200 / 15min).
// - apiLimiter: 120 requisições / min para toda a API (exceto health check).
// - publicResponseLimiter: 60 envios / min para o endpoint público de respostas.
//
// A chave do authLimiter inclui o e-mail, não apenas o IP. Antes, 20 erros de
// QUALQUER conta esgotavam a cota do IP inteiro por 15 min: em redes com NAT
// (totens, escritórios, operadoras móveis) um usuário errando a senha bloqueava
// todos os outros, mesmo com a senha correta. Agora cada conta tem sua própria
// cota e o authIpLimiter (bem mais folgado) impede varredura de várias contas.
const AUTH_WINDOW_MS = 15 * 60 * 1000;
const AUTH_RATE_LIMIT_MAX = Math.max(1, Number(process.env.AUTH_RATE_LIMIT_MAX) || 20);
const AUTH_IP_RATE_LIMIT_MAX = Math.max(
  AUTH_RATE_LIMIT_MAX,
  Number(process.env.AUTH_IP_RATE_LIMIT_MAX) || 200,
);

function authEmail(req: any): string {
  const raw = req.body?.email;
  return typeof raw === "string" ? raw.trim().toLowerCase() : "";
}

// IPv6 precisa ser agrupado por sub-rede (ipKeyGenerator) para não permitir
// bypass trocando o sufixo do endereço.
function authKey(req: any): string {
  const ip = ipKeyGenerator(req.ip || "unknown");
  const email = authEmail(req);
  return email ? `${ip}|${email}` : ip;
}

// Só 401/403 contam como tentativa de adivinhar credencial. Erros de validação
// (400), falhas do servidor/banco (5xx) e o próprio 429 não podem consumir a
// cota — senão uma indisponibilidade momentânea do banco bloqueia o login de
// todo mundo por 15 minutos.
function isCredentialFailure(_req: any, res: any) {
  return res.statusCode !== 401 && res.statusCode !== 403;
}

function authRateLimitHandler(label: string) {
  return (req: any, res: any, _next: any, options: any) => {
    console.warn(
      `[rate-limit] ${label} bloqueado ip=${req.ip} email=${authEmail(req) || "-"} rota=${req.originalUrl}`,
    );
    res.status(options.statusCode).send(options.message);
  };
}

const authLimiterBase = {
  windowMs: AUTH_WINDOW_MS,
  skipSuccessfulRequests: true,
  requestWasSuccessful: isCredentialFailure,
  skip: (req: any) => req.method === "OPTIONS",
  standardHeaders: true,
  legacyHeaders: false,
};

export const authLimiter = rateLimit({
  ...authLimiterBase,
  max: AUTH_RATE_LIMIT_MAX,
  keyGenerator: authKey,
  handler: authRateLimitHandler("login-conta"),
  message: {
    error: "Muitas tentativas de login para esta conta. Aguarde 15 minutos e tente novamente.",
  },
});

export const authIpLimiter = rateLimit({
  ...authLimiterBase,
  max: AUTH_IP_RATE_LIMIT_MAX,
  keyGenerator: (req: any) => ipKeyGenerator(req.ip || "unknown"),
  handler: authRateLimitHandler("login-ip"),
  message: {
    error: "Muitas tentativas de login a partir desta rede. Aguarde 15 minutos e tente novamente.",
  },
});

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  // Montado em "/api", então req.path chega sem o prefixo.
  skip: (req: any) => {
    const path = req.path || "";
    return path.startsWith("/health") || path.startsWith("/api/health");
  },
  message: { error: "Muitas requisições. Tente novamente mais tarde." },
});
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

// Projeção pública de uma campanha: expõe apenas os campos que o kiosk/survey
// precisa renderizar. Oculta dados internos (user_id, report_email, contadores,
// percepções, is_global, timestamps) que não devem vazar em endpoints anônimos.
export function publicCampaign(campaign: any) {
  if (!campaign) return campaign;
  const allowed = [
    "id",
    "name",
    "type",
    "status",
    "description",
    "privacy_text",
    "thank_you_message",
    "start_image",
    "end_image",
    "flow_layout",
    "questions",
    "responses_count",
  ];
  const safe: any = {};
  for (const key of allowed) {
    if (campaign[key] !== undefined) safe[key] = campaign[key];
  }
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

// Converte uma Date (ou string de data) em "YYYY-MM-DD" (formato de chave de dia)
// no fuso de Brasília. Usar UTC aqui fazia respostas das 21h BRT (00h UTC do dia
// seguinte) caírem no bucket do dia errado nos relatórios/evolução.
export function toISODate(date: Date | string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(date));
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