import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {
  prisma,
  JWT_SECRET,
  authLimiter,
  authenticateToken,
  publicUser,
  BLOCKED_ACCOUNT_ERROR,
} from "../deps";
import { normalizeEmail } from "../terminal-email";
import { logAudit } from "../audit";

// ============================================================================
// Auditoria de logins.
//
// Todo login (plataforma ou kiosk), com sucesso OU falha, gera um log para que
// o master admin consiga auditar reclamações ("quem acessou quando?"). A falha
// registra também o motivo (senha errada, conta bloqueada etc.) e o IP.
// ============================================================================

// Camada de baixo nível: converte os dados do login em um evento de auditoria.
// O `action` é derivado do tipo de ator (user → plataforma, terminal → kiosk).
function logLogin(
  req: any,
  data: {
    actorType: string;
    actorId: string | null;
    actorLabel: string;
    companyEmail?: string | null;
    companyName?: string | null;
    success: boolean;
    reason: string;
  },
) {
  logAudit(prisma, req, {
    ...data,
    action: data.actorType === "terminal" ? "terminal.login" : "auth.login",
    entityType: "auth",
    details: { reason: data.reason },
  });
}

// Registra tentativa de login de um usuário da PLATAFORMA.
// - `user`: usuário encontrado (ausente quando o e-mail não existe).
// - `attemptedEmail`: e-mail tentado, usado quando não há usuário para exibir.
function logUserLogin(
  req: any,
  options: {
    user?: any;
    attemptedEmail?: string;
    success: boolean;
    reason: string;
  },
) {
  logLogin(req, {
    actorType: "user",
    actorId: options.user?.id ?? null,
    actorLabel: options.attemptedEmail || options.user?.email || "",
    companyEmail: options.user?.email ?? null,
    companyName: options.user?.empresa || null,
    success: options.success,
    reason: options.reason,
  });
}

// Registra tentativa de login de um TERMINAL (kiosk).
// A empresa registrada é a do DONO do terminal (o usuário que o criou).
function logTerminalLogin(
  req: any,
  options: {
    terminal?: any;
    ownerUser?: any;
    attemptedEmail?: string;
    success: boolean;
    reason: string;
  },
) {
  logLogin(req, {
    actorType: "terminal",
    actorId: options.terminal?.id ?? null,
    actorLabel: options.attemptedEmail || options.terminal?.email || "",
    companyEmail: options.ownerUser?.email ?? null,
    companyName: options.ownerUser?.empresa || null,
    success: options.success,
    reason: options.reason,
  });
}

// Must be registered BEFORE the global /api rate limiter (original ordering)
export function registerEarlyAuthRoutes(app: any) {
  app.post("/api/auth/register", authLimiter, async (req: any, res: any) => {
    const { email, password, nome, empresa } = req.body;
    if (!email || !password) {
      return res
        .status(400)
        .json({ error: "E-mail e senha são obrigatórios." });
    }
    if (typeof password !== "string" || password.length < 8) {
      return res
        .status(400)
        .json({ error: "A senha deve ter no mínimo 8 caracteres." });
    }
    const cleanEmail = String(email).trim().toLowerCase();
    try {
      const hashedPassword = await bcrypt.hash(password, 10);

      // Calculate 7 days trial
      const now = new Date();
      const trialExpiration = new Date(now);
      trialExpiration.setDate(trialExpiration.getDate() + 7);

      // 1+2. Create User and Company atomically (no orphaned user if company fails)
      const created = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: cleanEmail,
            password: hashedPassword,
            nome: nome || cleanEmail.split("@")[0],
            empresa: empresa || "Minha Empresa",
            plano: "Teste 7 dias",
            vencimento: trialExpiration.toISOString(),
            status: "Ativo",
            max_terminals: 5,
          },
        });

        await tx.company.create({
          data: {
            empresa: empresa || "Minha Empresa",
            email: cleanEmail,
            // password: password, // REMOVED: security risk
            responsavel: nome || cleanEmail.split("@")[0],
            cnpj: "", // Required field in schema
            plano: "Teste 7 dias",
            vencimento: trialExpiration.toISOString(),
            status: "Ativo",
            max_terminals: 5,
          },
        });

        return user;
      });

      const token = jwt.sign({ id: created.id, email: created.email }, JWT_SECRET, {
        expiresIn: "7d",
      });
      res.json({ user: publicUser(created), session: { access_token: token } });
    } catch (err: any) {
      console.error("Register error:", err);
      if (err.code === "P2002") {
        return res.status(400).json({ error: "Este e-mail já está em uso." });
      }
      res.status(500).json({ error: "Erro ao criar conta." });
    }
  });
}

export function registerAuthRoutes(app: any) {
  app.post("/api/auth/login", authLimiter, async (req: any, res: any) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res
        .status(400)
        .json({ error: "E-mail e senha são obrigatórios." });
    }
    const cleanEmail = String(email).trim().toLowerCase();
    try {
      const user = await prisma.user.findUnique({
        where: { email: cleanEmail },
      });
      if (!user || !user.password) {
        console.log(`Login failed: user not found`);
        logUserLogin(req, { attemptedEmail: cleanEmail, success: false, reason: "usuário não encontrado" });
        return res.status(401).json({ error: "E-mail ou senha incorretos." });
      }
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        console.log(`Login failed: incorrect password`);
        logUserLogin(req, { user, success: false, reason: "senha incorreta" });
        return res.status(401).json({ error: "E-mail ou senha incorretos." });
      }
      if (user.status !== "Ativo") {
        logUserLogin(req, { user, success: false, reason: "conta bloqueada" });
        return res
          .status(403)
          .json({ error: "Conta bloqueada. Entre em contato com o suporte." });
      }
      const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
        expiresIn: "7d",
      });
      logUserLogin(req, { user, success: true, reason: "login realizado" });
      res.json({
        message: "Login OK",
        user: publicUser(user),
        session: { access_token: token },
      });
    } catch (err: any) {
      console.error("Login error:", err);
      res.status(500).json({ error: "Erro na conexão com o servidor." });
    }
  });

  app.post("/api/terminals/login", authLimiter, async (req: any, res: any) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res
        .status(401)
        .json({ error: "Credenciais de terminal inválidas" });
    }
    try {
      const terminal = await prisma.terminal.findUnique({
        where: { email: normalizeEmail(String(email)) },
      });

      if (!terminal || !terminal.password) {
        logTerminalLogin(req, { attemptedEmail: String(email).trim().toLowerCase(), success: false, reason: "credenciais inválidas" });
        return res
          .status(401)
          .json({ error: "Credenciais de terminal inválidas" });
      }

      const isValid =
        terminal.password.startsWith("$2b$") ||
        terminal.password.startsWith("$2a$")
          ? await bcrypt.compare(password, terminal.password)
          : password === terminal.password;
      if (!isValid) {
        logTerminalLogin(req, { terminal, success: false, reason: "credenciais inválidas" });
        return res
          .status(401)
          .json({ error: "Credenciais de terminal inválidas" });
      }

      if (terminal.status === "Bloqueado") {
        logTerminalLogin(req, { terminal, success: false, reason: "terminal bloqueado" });
        return res.status(403).json(BLOCKED_ACCOUNT_ERROR);
      }

      if (
        !terminal.password.startsWith("$2b$") &&
        !terminal.password.startsWith("$2a$")
      ) {
        const hashedPassword = await bcrypt.hash(password, 10);
        await prisma.terminal.update({
          where: { id: terminal.id },
          data: { password: hashedPassword },
        });
      }

      const user = await prisma.user.findUnique({
        where: { id: terminal.user_id },
      });

      if (!user) {
        logTerminalLogin(req, { terminal, success: false, reason: "conta do dono não encontrada" });
        return res.status(403).json(BLOCKED_ACCOUNT_ERROR);
      }

      if (user.status !== "Ativo") {
        logTerminalLogin(req, { terminal, ownerUser: user, success: false, reason: "conta bloqueada" });
        return res.status(403).json(BLOCKED_ACCOUNT_ERROR);
      }

      if (user.plano === "Teste 7 dias" && user.vencimento) {
        const expirationDate = new Date(user.vencimento);
        if (new Date() > expirationDate) {
          logTerminalLogin(req, { terminal, ownerUser: user, success: false, reason: "período de teste expirado" });
          return res.status(403).json({
            error: "Período de teste expirado. Entre em contato com o suporte.",
          });
        }
      }

      // Terminals use a simple token tied to their owner (user_id) but we can put the terminal ID in the token too
      const token = jwt.sign(
        {
          id: terminal.user_id,
          terminal_id: terminal.id,
          email: terminal.email,
          isTerminal: true,
        },
        JWT_SECRET,
        { expiresIn: "7d" },
      );

      // Registra o login com sucesso do terminal no sistema de logs.
      logTerminalLogin(req, { terminal, ownerUser: user, success: true, reason: "login realizado" });

      res.json({
        id: terminal.id,
        name: terminal.name,
        user_id: terminal.user_id,
        campaigns: terminal.campaigns,
        email: terminal.email,
        company_name: user.empresa || "Minha Empresa",
        logo_url: user.logo_url,
        access_token: token,
      });
    } catch (err: any) {
      console.error("Terminal login error:", err);
      res.status(500).json({ error: "Erro no servidor." });
    }
  });

  app.get("/api/auth/me", authenticateToken, async (req: any, res: any) => {
    try {
      const userRole = await prisma.user.findUnique({
        where: { id: req.user.id },
      });
      if (!userRole) return res.status(404).json({ error: "User not found" });

      const userData = {
        ...publicUser(userRole),
        terminal_id: req.user.terminal_id,
      };

      res.json({ user: userData });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
}
