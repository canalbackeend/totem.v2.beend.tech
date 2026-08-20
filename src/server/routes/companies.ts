import bcrypt from "bcryptjs";
import { prisma, authenticateToken, whitelist, publicCompany, ADMIN_EMAIL } from "../deps";

// Admin Companies
export function registerCompanyRoutes(app: any) {
  app.get("/api/companies", authenticateToken, async (req: any, res) => {
    if (req.user.email !== ADMIN_EMAIL) return res.sendStatus(403);
    const { page = "1", pageSize = "10", search } = req.query;
    const p = parseInt(page as string) || 1;
    const ps = parseInt(pageSize as string) || 10;
    const where: any = {};
    if (search) {
      const term = String(search).trim();
      if (term) {
        where.OR = [
          { empresa: { contains: term, mode: "insensitive" } },
          { cnpj: { contains: term } },
          { email: { contains: term, mode: "insensitive" } },
          { responsavel: { contains: term, mode: "insensitive" } }
        ];
      }
    }
    
    try {
      const [companies, count] = await prisma.$transaction([
        prisma.company.findMany({
          where,
          orderBy: { created_at: "desc" },
          skip: (p - 1) * ps,
          take: ps
        }),
        prisma.company.count({ where })
      ]);
      res.json({ data: companies.map(publicCompany), count });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/companies/:id/access-data", authenticateToken, async (req: any, res) => {
    if (req.user.email !== ADMIN_EMAIL) return res.sendStatus(403);
    try {
      const company = await prisma.company.findUnique({ where: { id: req.params.id } });
      if (!company) return res.status(404).json({ error: "Empresa não encontrada" });

      const user = await prisma.user.findUnique({ where: { email: company.email } });

      const terminals = user
        ? await prisma.terminal.findMany({
            where: { user_id: user.id },
            select: { name: true, email: true }
          })
        : [];

      res.json({
        responsavel: company.responsavel,
        empresa: company.empresa,
        email: company.email,
        terminals
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/companies/:id", authenticateToken, async (req: any, res) => {
    if (req.user.email !== ADMIN_EMAIL) return res.sendStatus(403);
    try {
      const company = await prisma.company.findUnique({ where: { id: req.params.id } });
      res.json(publicCompany(company));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/companies", authenticateToken, async (req: any, res) => {
    if (req.user.email !== ADMIN_EMAIL) return res.sendStatus(403);
    try {
      const cleanEmail = String(req.body.email || "").trim().toLowerCase();
      
      if (!req.body.empresa || typeof req.body.empresa !== "string" || !req.body.empresa.trim()) {
        return res.status(400).json({ error: "Nome da empresa é obrigatório." });
      }
      if (!req.body.responsavel || typeof req.body.responsavel !== "string" || !req.body.responsavel.trim()) {
        return res.status(400).json({ error: "Responsável é obrigatório." });
      }
      if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        return res.status(400).json({ error: "E-mail inválido." });
      }
      if (req.body.max_terminals !== undefined && (typeof req.body.max_terminals !== "number" || Number.isNaN(req.body.max_terminals))) {
        return res.status(400).json({ error: "max_terminals deve ser um número." });
      }
      
      // Check if user already exists
      const existingUser = await prisma.user.findUnique({ where: { email: cleanEmail } });
      
      const company = await prisma.company.create({ 
        data: { 
          ...whitelist(req.body, ["empresa", "responsavel", "cnpj", "telefone", "cep", "endereco", "complemento", "cidade", "estado", "plano", "vencimento", "status", "logo_url", "max_terminals"]),
          email: cleanEmail,
        } 
      });
      
      // Create or update corresponding user so they can login
      const rawPassword = String(req.body.password || '123456').trim();
      const hashedPassword = await bcrypt.hash(rawPassword, 10);
      
      await prisma.user.upsert({
        where: { email: cleanEmail },
        update: {
          empresa: company.empresa,
          responsavel: company.responsavel,
          password: hashedPassword,
          cnpj: company.cnpj,
          telefone: company.telefone,
          status: company.status,
          plano: company.plano || 'Mensal',
          vencimento: company.vencimento,
          max_terminals: company.max_terminals,
          cep: company.cep,
          endereco: company.endereco,
          complemento: company.complemento,
          cidade: company.cidade,
          estado: company.estado,
          logo_url: company.logo_url
        },
        create: {
          email: cleanEmail,
          password: hashedPassword,
          empresa: company.empresa,
          responsavel: company.responsavel,
          cnpj: company.cnpj,
          telefone: company.telefone,
          plano: company.plano || 'Mensal',
          vencimento: company.vencimento,
          status: company.status,
          max_terminals: company.max_terminals,
          cep: company.cep,
          endereco: company.endereco,
          complemento: company.complemento,
          cidade: company.cidade,
          estado: company.estado,
          logo_url: company.logo_url
        }
      });

      res.json(publicCompany(company));
    } catch (err: any) {
      console.error("Create company error:", err);
      res.status(500).json({ error: "Erro ao criar empresa." });
    }
  });

  app.patch("/api/companies/:id", authenticateToken, async (req: any, res) => {
    if (req.user.email !== ADMIN_EMAIL) return res.sendStatus(403);
    try {
      const oldCompany = await prisma.company.findUnique({ where: { id: req.params.id } });
      if (!oldCompany) return res.status(404).json({ error: "Empresa não encontrada" });

      const updateData: any = whitelist(req.body, ["empresa", "responsavel", "email", "cnpj", "telefone", "cep", "endereco", "complemento", "cidade", "estado", "plano", "vencimento", "status", "logo_url", "max_terminals"]);
      if (updateData.email) {
        updateData.email = String(updateData.email).trim().toLowerCase();
      }

      const company = await prisma.company.update({
        where: { id: req.params.id },
        data: updateData
      });

      // Sync with User table
      const cleanEmail = company.email;
      const oldEmail = oldCompany.email;

      const userUpdateData: any = {
        empresa: company.empresa,
        responsavel: company.responsavel,
        cnpj: company.cnpj,
        telefone: company.telefone,
        status: company.status,
        plano: company.plano || 'Mensal',
        vencimento: company.vencimento,
        max_terminals: company.max_terminals,
        cep: company.cep,
        endereco: company.endereco,
        complemento: company.complemento,
        cidade: company.cidade,
        estado: company.estado,
        logo_url: company.logo_url
      };

      if (req.body.password) {
        const rawPassword = String(req.body.password).trim();
        userUpdateData.password = await bcrypt.hash(rawPassword, 10);
        userUpdateData.email = cleanEmail; // Ensure email is also updated in User table
      }

      // If email changed, we need to update the user with the OLD email to the NEW email
      if (cleanEmail !== oldEmail) {
        userUpdateData.email = cleanEmail;
        await prisma.user.updateMany({
          where: { email: oldEmail },
          data: userUpdateData
        });
      } else {
        await prisma.user.updateMany({
          where: { email: cleanEmail },
          data: userUpdateData
        });
      }

      res.json(publicCompany(company));
    } catch (err: any) {
      console.error("Update company error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/companies/:id/reset-password", authenticateToken, async (req: any, res) => {
    if (req.user.email !== ADMIN_EMAIL) return res.sendStatus(403);
    try {
      const company = await prisma.company.findUnique({ where: { id: req.params.id } });
      if (!company) return res.status(404).json({ error: "Empresa não encontrada" });

      const newPassword = req.body.password || '123456';
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await prisma.$transaction([
        prisma.user.updateMany({
          where: { email: company.email },
          data: { password: hashedPassword }
        })
      ]);

      res.json({ message: "Senha alterada com sucesso" });
    } catch (err: any) {
      console.error("Reset password error:", err);
      res.status(500).json({ error: "Erro ao resetar senha." });
    }
  });

  app.patch("/api/companies/:id/status", authenticateToken, async (req: any, res) => {
    if (req.user.email !== ADMIN_EMAIL) return res.sendStatus(403);
    try {
      const { status } = req.body;
      if (!["Ativo", "Bloqueado"].includes(status)) {
        return res.status(400).json({ error: "Status inválido. Use 'Ativo' ou 'Bloqueado'." });
      }

      const company = await prisma.company.findUnique({ where: { id: req.params.id } });
      if (!company) return res.status(404).json({ error: "Empresa não encontrada" });

      const user = await prisma.user.findUnique({ where: { email: company.email } });

      await prisma.$transaction([
        prisma.company.update({
          where: { id: req.params.id },
          data: { status }
        }),
        prisma.user.updateMany({
          where: { email: company.email },
          data: { status }
        }),
        ...(user ? [prisma.terminal.updateMany({
          where: { user_id: user.id },
          data: { status: status === "Bloqueado" ? "Bloqueado" : "offline" }
        })] : [])
      ]);

      res.json({ message: `Empresa ${status === "Ativo" ? "desbloqueada" : "bloqueada"} com sucesso`, status });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/companies/:id", authenticateToken, async (req: any, res) => {
    if (req.user.email !== ADMIN_EMAIL) return res.sendStatus(403);
    try {
      await prisma.company.delete({ where: { id: req.params.id } });
      res.sendStatus(204);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
}