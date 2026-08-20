import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

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
export const ADMIN_RESET_SECRET = process.env.ADMIN_RESET_SECRET || ADMIN_PASSWORD;

export const prisma = new PrismaClient();

export const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: { error: "Muitas tentativas. Tente novamente mais tarde." } });
export const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 120, skip: (req) => req.path.startsWith("/api/health"), message: { error: "Muitas requisições. Tente novamente mais tarde." } });
export const publicResponseLimiter = rateLimit({ windowMs: 60 * 1000, max: 60, message: { error: "Muitas requisições. Tente novamente mais tarde." } });

export function whitelist(obj: any, allowed: string[]) {
  const safe: any = {};
  for (const key of allowed) {
    if (obj[key] !== undefined) safe[key] = obj[key];
  }
  return safe;
}

// Remove sensitive fields from objects before sending them to clients
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

// Parse terminal.campaigns which may be stored as CSV or JSON array
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
      // fall through to CSV parsing
    }
  }
  return trimmed.split(",").map((c: string) => c.trim()).filter(Boolean);
}

// Auth Middleware
export const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};