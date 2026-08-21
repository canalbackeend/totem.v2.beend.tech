import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import { app } from "../../server.ts";
import { JWT_SECRET } from "../../src/server/deps";

const prisma = new PrismaClient();

let OWNER_ID = "";
let TERMINAL_ID = "";
let CAMPAIGN_ID = "";
let terminalToken = "";
const createdTokens: string[] = [];

beforeAll(async () => {
  // Pick a real terminal whose owner account is active, so the 403 below comes
  // from the terminal guard itself (not from the account being blocked).
  const terminals = await prisma.terminal.findMany({ include: { user: true } });
  const usable = terminals.find((t) => t.user?.status === "Ativo");
  expect(usable).toBeTruthy();
  TERMINAL_ID = usable!.id;
  OWNER_ID = usable!.user_id;

  const campaign = await prisma.campaign.findFirst();
  expect(campaign).toBeTruthy();
  CAMPAIGN_ID = campaign!.id;

  // Build a terminal JWT exactly like the server does (src/server/routes/auth.ts)
  terminalToken = jwt.sign(
    { id: OWNER_ID, terminal_id: TERMINAL_ID, email: usable!.email || "", isTerminal: true },
    JWT_SECRET,
    { expiresIn: "7d" },
  );
});

afterAll(async () => {
  if (createdTokens.length > 0) {
    await prisma.reportToken.deleteMany({ where: { token: { in: createdTokens } } });
  }
});

describe("Segurança: terminais não podem agir como o dono (IDOR)", () => {
  it("PATCH /api/profiles/:id é negado para terminal e não altera o perfil do dono", async () => {
    const before = await prisma.user.findUnique({ where: { id: OWNER_ID } });

    const res = await request(app)
      .patch(`/api/profiles/${OWNER_ID}`)
      .set("Authorization", `Bearer ${terminalToken}`)
      .send({ nome: "HACKED", password: "troquei-a-senha" });

    expect(res.status).toBe(403);

    const after = await prisma.user.findUnique({ where: { id: OWNER_ID } });
    expect(after?.nome).toBe(before?.nome);
  });

  it("POST /api/campaigns/:id/reset é negado para terminal", async () => {
    const res = await request(app)
      .post(`/api/campaigns/${CAMPAIGN_ID}/reset`)
      .set("Authorization", `Bearer ${terminalToken}`);

    expect(res.status).toBe(403);
  });
});

describe("Segurança: projeção pública de campanha", () => {
  it("GET /api/survey/campaign/:id não expõe dados internos", async () => {
    const res = await request(app).get(`/api/survey/campaign/${CAMPAIGN_ID}`);

    expect(res.status).toBe(200);
    const body = res.body;
    expect(body).toBeTruthy();
    expect(body.id).toBe(CAMPAIGN_ID);
    expect(body.questions).toBeDefined();

    // Campos internos/sensíveis nunca devem vazar em endpoint anônimo
    expect(body.user_id).toBeUndefined();
    expect(body.report_email).toBeUndefined();
    expect(body.report_time).toBeUndefined();
    expect(body.is_global).toBeUndefined();
    expect(body.perception_excelente).toBeUndefined();
    expect(body.perception_bom).toBeUndefined();
  });
});

describe("Segurança: token de relatório de uso único", () => {
  async function createToken() {
    const token = `test-sec-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    createdTokens.push(token);
    await prisma.reportToken.create({
      data: {
        token,
        campaign_id: CAMPAIGN_ID,
        expires_at: new Date(Date.now() + 60 * 60 * 1000),
        is_used: false,
      },
    });
    return token;
  }

  it("primeira chamada retorna 200, a segunda 404 (consumo imediato)", async () => {
    const token = await createToken();

    const first = await request(app).get(`/api/reports/check-token/${token}`);
    expect(first.status).toBe(200);

    const second = await request(app).get(`/api/reports/check-token/${token}`);
    expect(second.status).toBe(404);
  });

  it("duas chamadas paralelas: exatamente uma retorna 200 (TOCTOU)", async () => {
    const token = await createToken();

    const [a, b] = await Promise.all([
      request(app).get(`/api/reports/check-token/${token}`),
      request(app).get(`/api/reports/check-token/${token}`),
    ]);

    expect([a.status, b.status].sort()).toEqual([200, 404]);
  });
});
