import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import cron from "node-cron";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { prisma, ADMIN_EMAIL, ADMIN_PASSWORD, PORT } from "./deps";
import { app } from "./app";
import { sendDailyReports } from "./email";

async function ensureAdminExists() {
  try {
    console.log(`Checking admin user: ${ADMIN_EMAIL}`);
    const admin = await prisma.user.findUnique({
      where: { email: ADMIN_EMAIL }
    });

    if (!admin) {
      console.log(`Admin ${ADMIN_EMAIL} not found, creating...`);
      const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
      await prisma.user.create({
        data: {
          email: ADMIN_EMAIL,
          password: hashedPassword,
          nome: "Administrador Master",
          empresa: "beend.tech",
          role: "Administrador",
          status: "Ativo"
        }
      });
      console.log(`Master admin created: ${ADMIN_EMAIL}`);
    } else {
      console.log(`Admin ${ADMIN_EMAIL} already exists`);
    }
  } catch (err) {
    console.error("Error ensuring admin exists:", err);
  }
}

// Sync all companies to users table to ensure everyone can login.
// Só cria Users que faltam (backfill de empresas legadas). NUNCA sobrescreve um
// User existente: o boot sobrescrevia empresa/status/plano/vencimento a cada
// start, descartando alterações feitas diretamente no User.
async function syncCompaniesToUsers() {
  try {
    const companies = await prisma.company.findMany();
    for (const comp of companies) {
      const cleanEmail = String(comp.email).trim().toLowerCase();
      if (!cleanEmail) continue;

      const existingUser = await prisma.user.findUnique({ where: { email: cleanEmail } });
      if (existingUser) continue;

      await prisma.user.create({
        data: {
          email: cleanEmail,
          password: await bcrypt.hash("123456", 10),
          empresa: comp.empresa,
          responsavel: comp.responsavel,
          cnpj: comp.cnpj,
          telefone: comp.telefone,
          status: comp.status,
          plano: comp.plano || "Mensal",
          vencimento: comp.vencimento,
          max_terminals: comp.max_terminals,
          cep: comp.cep,
          endereco: comp.endereco,
          complemento: comp.complemento,
          cidade: comp.cidade,
          estado: comp.estado,
          logo_url: comp.logo_url
        }
      });
    }
    console.log("Sync companies to users completed.");
  } catch (err) {
    console.error("Error syncing companies to users:", err);
  }
}

// Cron concurrency guard (in-process)
let cronRunning = false;

// Lock distribuído para o cron de relatórios: `pg_advisory_lock` exige que o
// unlock ocorra na MESMA conexão. Como o pool padrão do Prisma pode usar
// conexões diferentes, usamos um client dedicado com connection_limit=1.
// Isso impede que múltiplas instâncias (ex.: Coolify com replicas) enviem o
// mesmo relatório diário em duplicado.
const LOCK_DB_URL = (() => {
  const url = process.env.DATABASE_URL || "";
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}connection_limit=1`;
})();
const reportLockClient = new PrismaClient({ datasourceUrl: LOCK_DB_URL });
const DAILY_REPORTS_LOCK_KEY = 7248361;

// Ability to disable daily reports via env var (useful for isolation tests)
// Set ENABLE_DAILY_REPORTS=false in Coolify to turn the daily report cron off.
const dailyReportsEnabled = process.env.ENABLE_DAILY_REPORTS !== "false";

// Schedule task to run every minute and check the time
if (dailyReportsEnabled) {
  cron.schedule("* * * * *", async () => {
    if (cronRunning) return;
    cronRunning = true;
    try {
      // Tenta adquirir o lock global. Se outra instância estiver processando
      // relatórios, pula este tick (evita envio duplicado).
      const lockResult = await reportLockClient.$queryRaw<{ acquired: boolean }[]>`SELECT pg_try_advisory_lock(${DAILY_REPORTS_LOCK_KEY}) AS acquired`;
      if (!lockResult[0]?.acquired) return;
      try {
        const now = new Date();
        
        // Format as HH:mm in America/Sao_Paulo timezone
        const formatter = new Intl.DateTimeFormat('pt-BR', {
          timeZone: 'America/Sao_Paulo',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });
        
        const targetTimeStr = formatter.format(now);
        await sendDailyReports(targetTimeStr);
      } finally {
        await reportLockClient.$queryRaw`SELECT pg_advisory_unlock(${DAILY_REPORTS_LOCK_KEY})`.catch(() => {});
      }
    } finally {
      cronRunning = false;
    }
  }, {
    timezone: "America/Sao_Paulo"
  });
}

export async function startServer() {
  // Seed the admin user if missing and sync companies
  await ensureAdminExists();
  await syncCompaniesToUsers();

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache, must-revalidate, proxy-revalidate');
        }
      }
    }));
    app.get("*", (req, res) => {
      res.setHeader('Cache-Control', 'no-cache, must-revalidate, proxy-revalidate');
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  const shutdown = (signal: string) => {
    console.log(`Recebido ${signal}. Encerrando servidor graciosamente...`);
    server.close(async () => {
      await prisma.$disconnect();
      await reportLockClient.$disconnect().catch(() => {});
      process.exit(0);
    });
    // Force exit if close hangs (e.g. open keep-alive connections)
    setTimeout(() => process.exit(0), 10000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}