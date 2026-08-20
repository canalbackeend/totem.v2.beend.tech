import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma, JWT_SECRET, authLimiter, authenticateToken, publicUser } from "../deps";
import { normalizeEmail } from "../terminal-email";

// Must be registered BEFORE the global /api rate limiter (original ordering)
export function registerEarlyAuthRoutes(app: any) {
  app.post("/api/auth/register", authLimiter, async (req, res) => {
    const { email, password, nome, empresa } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "E-mail e senha são obrigatórios." });
    }
    const cleanEmail = String(email).trim().toLowerCase();
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Calculate 7 days trial
      const now = new Date();
      const trialExpiration = new Date(now);
      trialExpiration.setDate(trialExpiration.getDate() + 7);

      // 1. Create User
      const user = await prisma.user.create({
        data: {
          email: cleanEmail,
          password: hashedPassword,
          nome: nome || cleanEmail.split('@')[0],
          empresa: empresa || "Minha Empresa",
          plano: "Teste 7 dias",
          vencimento: trialExpiration.toISOString(),
          status: "Ativo",
          max_terminals: 5
        },
      });

      // 2. Create Company to show in /empresas list
      await prisma.company.create({
        data: {
          empresa: empresa || "Minha Empresa",
          email: cleanEmail,
          // password: password, // REMOVED: security risk
          responsavel: nome || cleanEmail.split('@')[0],
          cnpj: "", // Required field in schema
          plano: "Teste 7 dias",
          vencimento: trialExpiration.toISOString(),
          status: "Ativo",
          max_terminals: 5
        }
      });

      const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
      res.json({ user: publicUser(user), session: { access_token: token } });
    } catch (err: any) {
      console.error("Register error:", err);
      if (err.code === 'P2002') {
        return res.status(400).json({ error: "Este e-mail já está em uso." });
      }
      res.status(500).json({ error: "Erro ao criar conta." });
    }
  });
}

export function registerAuthRoutes(app: any) {
  app.post("/api/auth/login", authLimiter, async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "E-mail e senha são obrigatórios." });
    }
    const cleanEmail = String(email).trim().toLowerCase();
    try {
      const user = await prisma.user.findUnique({ where: { email: cleanEmail } });
      if (!user || !user.password) {
        console.log(`Login failed: user not found`);
        return res.status(401).json({ error: "E-mail ou senha incorretos." });
      }
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        console.log(`Login failed: incorrect password`);
        return res.status(401).json({ error: "E-mail ou senha incorretos." });
      }
      if (user.status !== "Ativo") {
        return res.status(403).json({ error: "Conta bloqueada. Entre em contato com o suporte." });
      }
      const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
      res.json({ message: "Login OK", user: publicUser(user), session: { access_token: token } });
    } catch (err: any) {
      console.error("Login error:", err);
      res.status(500).json({ error: "Erro na conexão com o servidor." });
    }
  });

  app.post("/api/terminals/login", authLimiter, async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(401).json({ error: "Credenciais de terminal inválidas" });
    }
    try {
      const terminal = await prisma.terminal.findUnique({
        where: { email: normalizeEmail(String(email)) }
      });

      if (!terminal || !terminal.password) {
        return res.status(401).json({ error: "Credenciais de terminal inválidas" });
      }

      const isValid = terminal.password.startsWith("$2b$") || terminal.password.startsWith("$2a$")
        ? await bcrypt.compare(password, terminal.password)
        : password === terminal.password;
      if (!isValid) {
        return res.status(401).json({ error: "Credenciais de terminal inválidas" });
      }

      if (!terminal.password.startsWith("$2b$") && !terminal.password.startsWith("$2a$")) {
        const hashedPassword = await bcrypt.hash(password, 10);
        await prisma.terminal.update({
          where: { id: terminal.id },
          data: { password: hashedPassword }
        });
      }

      const user = await prisma.user.findUnique({ where: { id: terminal.user_id } });
      
      if (user && user.status !== "Ativo") {
        return res.status(403).json({ error: "Conta bloqueada. Entre em contato com o suporte." });
      }

      if (user && user.plano === "Teste 7 dias" && user.vencimento) {
        const expirationDate = new Date(user.vencimento);
        if (new Date() > expirationDate) {
          return res.status(403).json({ error: "Período de teste expirado. Entre em contato com o suporte." });
        }
      }

      // Terminals use a simple token tied to their owner (user_id) but we can put the terminal ID in the token too
      const token = jwt.sign({ id: terminal.user_id, terminal_id: terminal.id, email: terminal.email }, JWT_SECRET, { expiresIn: "7d" });
      
      res.json({
        id: terminal.id,
        name: terminal.name,
        user_id: terminal.user_id,
        campaigns: terminal.campaigns,
        email: terminal.email,
        company_name: user?.empresa || "Minha Empresa",
        logo_url: user?.logo_url,
        access_token: token
      });
    } catch (err: any) {
      console.error("Terminal login error:", err);
      res.status(500).json({ error: "Erro no servidor." });
    }
  });

  app.get("/api/auth/me", authenticateToken, async (req: any, res) => {
    try {
      const userRole = await prisma.user.findUnique({ where: { id: req.user.id } });
      if (!userRole) return res.status(404).json({ error: "User not found" });
      
      const userData = {
        ...publicUser(userRole),
        terminal_id: req.user.terminal_id
      };

      res.json({ user: userData });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
}