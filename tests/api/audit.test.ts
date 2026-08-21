import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { app } from "../../server.ts";
import { JWT_SECRET } from "../../src/server/deps";

const prisma = new PrismaClient();

const PREFIX = `audit-test-${Date.now()}`;
const TEST_USER_EMAIL = `${PREFIX}-user@test.com`;
const BOGUS_EMAIL = `${PREFIX}-bogus@test.com`;
const TEST_TERMINAL_EMAIL = `${PREFIX}-term@test.com`;

let adminToken = "";
let nonAdminToken = "";
let testUserId = "";
let testTerminalId = "";
let testCampaignId = "";

// Espera o log (fire-and-forget) aparecer no banco, com timeout.
async function waitForLog(predicate: () => Promise<boolean>, timeoutMs = 4000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await predicate()) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
}

beforeAll(async () => {
  const adminRes = await request(app)
    .post("/api/auth/login")
    .send({ email: "adm@beend.tech", password: "admin123" });
  expect(adminRes.status).toBe(200);
  adminToken = adminRes.body.session.access_token;

  // Usuário comum (não-admin) para testar a restrição do endpoint de logs.
  const other = await prisma.user.create({
    data: {
      email: `${PREFIX}-other@test.com`,
      password: await bcrypt.hash("senha123", 10),
      status: "Ativo",
      nome: "Outro Usuário",
    },
  });
  nonAdminToken = jwt.sign({ id: other.id, email: other.email }, JWT_SECRET, { expiresIn: "7d" });

  // Usuário de teste para logar na plataforma.
  const testUser = await prisma.user.create({
    data: {
      email: TEST_USER_EMAIL,
      password: await bcrypt.hash("senha123", 10),
      status: "Ativo",
      nome: "Usuário de Teste",
      empresa: "Empresa de Teste",
      max_terminals: 10,
    },
  });
  testUserId = testUser.id;

  // Terminal de teste para logar no kiosk.
  const terminal = await prisma.terminal.create({
    data: {
      name: "TERM-AUDIT-TESTE",
      email: TEST_TERMINAL_EMAIL,
      password: await bcrypt.hash("senha123", 10),
      user_id: testUserId,
      status: "offline",
    },
  });
  testTerminalId = terminal.id;
});

afterAll(async () => {
  const entityIds = [testCampaignId, testTerminalId].filter(Boolean);
  await prisma.auditLog.deleteMany({
    where: { OR: [{ actor_label: { in: [TEST_USER_EMAIL, BOGUS_EMAIL, TEST_TERMINAL_EMAIL, `${PREFIX}-other@test.com`] } }, { entity_id: { in: entityIds } }] },
  });

  await prisma.response.deleteMany({ where: { campaign_id: testCampaignId } });
  if (testTerminalId) await prisma.terminal.delete({ where: { id: testTerminalId } }).catch(() => {});
  if (testCampaignId) await prisma.campaign.delete({ where: { id: testCampaignId } }).catch(() => {});
  if (testUserId) await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
  await prisma.user.delete({ where: { email: `${PREFIX}-other@test.com` } }).catch(() => {});
});

describe("Auditoria: logins", () => {
  it("login na plataforma com sucesso gera log auth.login success=true", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: TEST_USER_EMAIL, password: "senha123" });
    expect(res.status).toBe(200);

    const found = await waitForLog(async () => {
      const log = await prisma.auditLog.findFirst({
        where: { actor_label: TEST_USER_EMAIL, action: "auth.login", success: true },
      });
      return !!log;
    });
    expect(found).toBe(true);
  });

  it("login na plataforma com senha errada gera log auth.login success=false", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: TEST_USER_EMAIL, password: "senha-errada" });
    expect(res.status).toBe(401);

    const found = await waitForLog(async () => {
      const log = await prisma.auditLog.findFirst({
        where: { actor_label: TEST_USER_EMAIL, action: "auth.login", success: false },
      });
      return !!log;
    });
    expect(found).toBe(true);
  });

  it("usuário inexistente gera log de falha com o e-mail tentado", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: BOGUS_EMAIL, password: "qualquer" });
    expect(res.status).toBe(401);

    const found = await waitForLog(async () => {
      const log = await prisma.auditLog.findFirst({
        where: { actor_label: BOGUS_EMAIL, action: "auth.login", success: false },
      });
      return !!log;
    });
    expect(found).toBe(true);
  });

  it("login no terminal (kiosk) gera log terminal.login", async () => {
    const res = await request(app)
      .post("/api/terminals/login")
      .send({ email: TEST_TERMINAL_EMAIL, password: "senha123" });
    expect(res.status).toBe(200);

    const found = await waitForLog(async () => {
      const log = await prisma.auditLog.findFirst({
        where: { actor_label: TEST_TERMINAL_EMAIL, action: "terminal.login", success: true },
      });
      return !!log;
    });
    expect(found).toBe(true);
  });
});

describe("Auditoria: campanhas", () => {
  it("criar campanha gera log campaign.create", async () => {
    const res = await request(app)
      .post("/api/campaigns")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: `${PREFIX}-campanha`, type: "pesquisa" });
    expect(res.status).toBe(200);
    testCampaignId = res.body.id;

    const found = await waitForLog(async () => {
      const log = await prisma.auditLog.findFirst({
        where: { entity_id: testCampaignId, action: "campaign.create" },
      });
      return !!log;
    });
    expect(found).toBe(true);
  });

  it("editar campanha gera log campaign.update com o diff de campos", async () => {
    const res = await request(app)
      .patch(`/api/campaigns/${testCampaignId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: `${PREFIX}-campanha-editada` });
    expect(res.status).toBe(200);

    const found = await waitForLog(async () => {
      const log = await prisma.auditLog.findFirst({
        where: { entity_id: testCampaignId, action: "campaign.update" },
      });
      const changed = (log?.details as any)?.changed;
      return changed && changed.name !== undefined;
    });
    expect(found).toBe(true);
  });

  it("resetar campanha gera log campaign.reset", async () => {
    const res = await request(app)
      .post(`/api/campaigns/${testCampaignId}/reset`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);

    const found = await waitForLog(async () => {
      const log = await prisma.auditLog.findFirst({
        where: { entity_id: testCampaignId, action: "campaign.reset" },
      });
      return !!log;
    });
    expect(found).toBe(true);
  });

  it("deletar campanha gera log campaign.delete", async () => {
    const res = await request(app)
      .delete(`/api/campaigns/${testCampaignId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(204);

    const found = await waitForLog(async () => {
      const log = await prisma.auditLog.findFirst({
        where: { entity_id: testCampaignId, action: "campaign.delete" },
      });
      return !!log;
    });
    expect(found).toBe(true);
  });
});

describe("Auditoria: terminais", () => {
  it("criar terminal gera log terminal.create", async () => {
    const res = await request(app)
      .post("/api/terminals")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: `${PREFIX}-terminal` });
    expect(res.status).toBe(200);
    const terminalId = res.body.id;

    const found = await waitForLog(async () => {
      const log = await prisma.auditLog.findFirst({
        where: { entity_id: terminalId, action: "terminal.create" },
      });
      return !!log;
    });
    expect(found).toBe(true);

    await prisma.auditLog.deleteMany({ where: { entity_id: terminalId } });
    await prisma.terminal.delete({ where: { id: terminalId } }).catch(() => {});
  });
});

describe("Auditoria: API de consulta", () => {
  it("GET /api/admin/logs bloqueado para não-master", async () => {
    const res = await request(app)
      .get("/api/admin/logs")
      .set("Authorization", `Bearer ${nonAdminToken}`);
    expect(res.status).toBe(403);
  });

  it("GET /api/admin/logs retorna lista paginada para o master admin", async () => {
    const res = await request(app)
      .get("/api/admin/logs?page=1&pageSize=20")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.count).toBeGreaterThanOrEqual(1);
    expect(res.body.data.length).toBeLessThanOrEqual(20);
  });

  it("GET /api/admin/logs filtra por busca, ação e sucesso", async () => {
    const res = await request(app)
      .get(`/api/admin/logs?search=${encodeURIComponent(PREFIX)}&action=terminal.login&success=true`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    // Toda entrada retornada deve corresponder ao prefixo de teste e ao login do terminal.
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    for (const entry of res.body.data) {
      expect(entry.action).toBe("terminal.login");
      expect(entry.success).toBe(true);
      expect(entry.actor_label).toContain(PREFIX);
    }
  });
});
