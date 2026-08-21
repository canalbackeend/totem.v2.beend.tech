import bcrypt from "bcryptjs";
import { prisma, authenticateToken, whitelist, isMasterAdmin, ADMIN_EMAIL } from "../deps";
import { normalizeEmail, isValidEmail, emailInUse, generateUniqueTerminalEmail } from "../terminal-email";

// Terminals
export function registerTerminalRoutes(app: any) {
  app.get("/api/terminals", authenticateToken, async (req: any, res: any) => {
    try {
      if (req.user.terminal_id) {
        const terminal = await prisma.terminal.findUnique({
          where: { id: req.user.terminal_id }
        });
        if (!terminal) return res.json([]);
        const { password, ...rest } = terminal;
        return res.json([{ ...rest, password: null }]);
      }

      const isMaster = isMasterAdmin(req);
      const profile = await prisma.user.findUnique({ where: { id: req.user.id } });
      const isAdmin = profile?.role === "Administrador";

      if (isMaster || isAdmin) {
        const companies = await prisma.company.findMany({
          select: { email: true, empresa: true }
        });
        const companyMap = new Map(companies.map(c => [c.email, c.empresa]));

        const terminals = await prisma.terminal.findMany({
          include: { user: { select: { email: true } } },
          orderBy: { created_at: "desc" }
        });

        const sanitized = terminals.map(({ password, user, ...rest }) => ({
          ...rest,
          password: null,
          company_name: companyMap.get(user.email) || null
        }));
        res.json(sanitized);
      } else {
        const terminals = await prisma.terminal.findMany({
          where: { user_id: req.user.id },
          orderBy: { created_at: "desc" }
        });
        const sanitized = terminals.map(({ password, ...rest }) => ({ ...rest, password: null }));
        res.json(sanitized);
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/terminals", authenticateToken, async (req: any, res: any) => {
    try {
      if (req.user.terminal_id) return res.status(403).json({ error: "Access denied" });

      const user = await prisma.user.findUnique({ where: { id: req.user.id } });
      if (!user) return res.status(404).json({ error: "Usuário não encontrado" });

      if (user.status !== "Ativo") {
        return res.status(403).json({ error: "Empresa bloqueada. Entre em contato com o suporte." });
      }

      const isMaster = isMasterAdmin(req);

      if (!isMaster && user.max_terminals > 0) {
        const termCount = await prisma.terminal.count({ where: { user_id: req.user.id } });
        if (termCount >= user.max_terminals) {
          return res.status(403).json({ error: `Limite de terminais atingido (${user.max_terminals}). Entre em contato com o suporte para aumentar seu limite.` });
        }
      }

      const { password, ...rest } = req.body;
      if (!rest.name || typeof rest.name !== "string" || !rest.name.trim()) {
        return res.status(400).json({ error: "Nome do terminal é obrigatório." });
      }
      const plainPassword = password || "term123";
      const hashedPassword = await bcrypt.hash(plainPassword, 10);

      let email = normalizeEmail(rest.email || "");
      if (!email) {
        email = await generateUniqueTerminalEmail();
      } else if (email === normalizeEmail(ADMIN_EMAIL)) {
        return res.status(400).json({ error: "E-mail não permitido para terminais." });
      } else if (!isValidEmail(email)) {
        return res.status(400).json({ error: "E-mail inválido. Verifique o formato." });
      } else if (await emailInUse(email)) {
        return res.status(409).json({ error: "Este login já está em uso por outro terminal." });
      }

      const terminal = await prisma.terminal.create({
        data: { ...whitelist(rest, ["name", "campaigns", "redirect_url", "status"]), email, password: hashedPassword, user_id: req.user.id }
      });
      const { password: _, ...terminalWithoutHash } = terminal;
      res.json({ ...terminalWithoutHash, password: plainPassword });
    } catch (err: any) {
      if (err?.code === "P2002") {
        return res.status(409).json({ error: "Este login já está em uso por outro terminal." });
      }
      console.error("Terminal create error:", err);
      res.status(500).json({ error: "Erro ao criar terminal." });
    }
  });

  app.patch("/api/terminals/:id", authenticateToken, async (req: any, res: any) => {
    try {
      if (req.user.terminal_id) return res.status(403).json({ error: "Access denied" });
      const where: any = { id: req.params.id };
      if (!isMasterAdmin(req)) {
        where.user_id = req.user.id;
      }
      const existing = await prisma.terminal.findFirst({ where });
      if (!existing) return res.status(404).json({ error: "Terminal não encontrado" });

      const { password, ...rest } = req.body;
      const updateData: any = { ...whitelist(rest, ["name", "campaigns", "redirect_url", "status"]) };

      if (rest.email !== undefined) {
        const email = normalizeEmail(rest.email);
        if (!email) {
          return res.status(400).json({ error: "O login não pode ficar vazio." });
        }
        if (!isValidEmail(email)) {
          return res.status(400).json({ error: "E-mail inválido. Verifique o formato." });
        }
        if (email === normalizeEmail(ADMIN_EMAIL)) {
          return res.status(400).json({ error: "E-mail não permitido para terminais." });
        }
        if (email !== normalizeEmail(existing.email || "") && (await emailInUse(email, existing.id))) {
          return res.status(409).json({ error: "Este login já está em uso por outro terminal." });
        }
        updateData.email = email;
      }

      if (password) {
        updateData.password = await bcrypt.hash(password, 10);
      }
      const terminal = await prisma.terminal.update({
        where: { id: existing.id },
        data: updateData
      });
      const { password: _, ...terminalWithoutHash } = terminal;
      res.json({ ...terminalWithoutHash, password: password || null });
    } catch (err: any) {
      if (err?.code === "P2002") {
        return res.status(409).json({ error: "Este login já está em uso por outro terminal." });
      }
      console.error("Terminal update error:", err);
      res.status(500).json({ error: "Erro ao atualizar terminal." });
    }
  });

  app.post("/api/terminals/:id/reset-password", authenticateToken, async (req: any, res: any) => {
    try {
      if (req.user.terminal_id) return res.status(403).json({ error: "Access denied" });
      const newPassword = req.body.password || "term123";
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      const where: any = { id: req.params.id };
      if (!isMasterAdmin(req)) {
        where.user_id = req.user.id;
      }
      const terminal = await prisma.terminal.update({
        where,
        data: { password: hashedPassword }
      });
      const { password: _, ...terminalWithoutHash } = terminal;
      res.json({ ...terminalWithoutHash, password: newPassword });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/terminals/:id", authenticateToken, async (req: any, res: any) => {
    try {
      if (req.user.terminal_id) return res.status(403).json({ error: "Access denied" });
      const where: any = { id: req.params.id };
      if (!isMasterAdmin(req)) {
        where.user_id = req.user.id;
      }
      const existing = await prisma.terminal.findFirst({ where });
      if (!existing) return res.status(404).json({ error: "Terminal não encontrado" });
      await prisma.terminal.delete({
        where: { id: existing.id }
      });
      res.sendStatus(204);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
}