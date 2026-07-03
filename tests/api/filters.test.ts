import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { PrismaClient } from "@prisma/client";
import { app } from "../../server.ts";

const prisma = new PrismaClient();

let TV_WITH_DATA = "";
let TV_WITHOUT_DATA = "";
let CAMPAIGN_WITH_DATA = "";
let CAMPAIGN_EMPTY = "";
let adminToken = "";

beforeAll(async () => {
  // Fetch dynamic IDs from DB so tests survive resets
  const terminals = await prisma.terminal.findMany();
  const termWithData = await prisma.response.groupBy({
    by: ["terminal_id"],
    _count: true,
    orderBy: { _count: { terminal_id: "desc" } },
  });
  TV_WITH_DATA = termWithData.find((t) => t.terminal_id)?.terminal_id || "";
  TV_WITHOUT_DATA = terminals.find((t) => t.id !== TV_WITH_DATA)?.id || "";

  const campaigns = await prisma.campaign.findMany({ orderBy: { created_at: "desc" } });
  const respCampaigns = await prisma.response.groupBy({
    by: ["campaign_id"],
    _count: true,
  });
  const campaignIdsWithData = new Set(respCampaigns.map((r) => r.campaign_id));
  CAMPAIGN_WITH_DATA = campaigns.find((c) => campaignIdsWithData.has(c.id))?.id || "";
  CAMPAIGN_EMPTY = campaigns.find((c) => !campaignIdsWithData.has(c.id))?.id || "";

  const res = await request(app)
    .post("/api/auth/login")
    .send({ email: "adm@beend.tech", password: "admin123" });

  expect(res.status).toBe(200);
  expect(res.body.session?.access_token).toBeTruthy();
  adminToken = res.body.session.access_token;
});

describe("GET /api/responses - filtro por terminal", () => {
  it("deve retornar todas as responses sem filtro", async () => {
    const res = await request(app)
      .get("/api/responses")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(4);
  });

  it("deve filtrar responses por terminal_id", async () => {
    const res = await request(app)
      .get(`/api/responses?terminal_id=${TV_WITH_DATA}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);

    for (const r of res.body) {
      expect(r.terminal_id).toBe(TV_WITH_DATA);
    }
  });

  it("deve retornar vazio para terminal sem responses", async () => {
    const res = await request(app)
      .get(`/api/responses?terminal_id=${TV_WITHOUT_DATA}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(0);
  });
});

describe("GET /api/responses - filtro por data", () => {
  it("deve retornar responses no range de data (03-07-2026)", async () => {
    const res = await request(app)
      .get("/api/responses?startDate=2026-07-03&endDate=2026-07-03")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(4);
  });

  it("deve retornar vazio para data sem responses (01-07-2026)", async () => {
    const res = await request(app)
      .get("/api/responses?startDate=2026-07-01&endDate=2026-07-01")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(0);
  });

  it("deve filtrar por terminal + data combinados", async () => {
    const res = await request(app)
      .get(`/api/responses?terminal_id=${TV_WITH_DATA}&startDate=2026-07-03&endDate=2026-07-03`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    for (const r of res.body) {
      expect(r.terminal_id).toBe(TV_WITH_DATA);
    }
  });
});

describe("GET /api/campaigns/:id/evolution - filtros (campanha com dados)", () => {
  it("deve retornar evolução sem filtros", async () => {
    const res = await request(app)
      .get(`/api/campaigns/${CAMPAIGN_WITH_DATA}/evolution?days=7`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.evolution).toBeDefined();
    expect(res.body.evolution.length).toBe(7);
  });

  it("deve filtrar evolução por terminal_id", async () => {
    const res = await request(app)
      .get(`/api/campaigns/${CAMPAIGN_WITH_DATA}/evolution?days=7&terminal_id=${TV_WITH_DATA}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.evolution).toBeDefined();
  });

  it("deve filtrar evolução por data (03-07-2026)", async () => {
    const res = await request(app)
      .get(`/api/campaigns/${CAMPAIGN_WITH_DATA}/evolution?startDate=2026-07-03&endDate=2026-07-03`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.evolution).toBeDefined();
    expect(res.body.evolution.length).toBeGreaterThanOrEqual(1);

    const dayWithData = res.body.evolution.find((d: any) => d.responses > 0);
    expect(dayWithData).toBeDefined();
  });

  it("deve retornar vazio para data sem responses", async () => {
    const res = await request(app)
      .get(`/api/campaigns/${CAMPAIGN_WITH_DATA}/evolution?startDate=2026-07-01&endDate=2026-07-01`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.evolution).toBeDefined();
    const allZero = res.body.evolution.every((d: any) => d.responses === 0);
    expect(allZero).toBe(true);
  });

  it("deve filtrar evolução por terminal + data combinados", async () => {
    const res = await request(app)
      .get(`/api/campaigns/${CAMPAIGN_WITH_DATA}/evolution?startDate=2026-07-03&endDate=2026-07-03&terminal_id=${TV_WITH_DATA}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.evolution).toBeDefined();
  });
});

describe("GET /api/campaigns/:id/evolution - campanha sem dados", () => {
  it("deve retornar evolução vazia para campanha resetada", async () => {
    const res = await request(app)
      .get(`/api/campaigns/${CAMPAIGN_EMPTY}/evolution?days=7`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.evolution).toBeDefined();
    expect(res.body.evolution.length).toBe(7);
    const allZero = res.body.evolution.every((d: any) => d.responses === 0);
    expect(allZero).toBe(true);
  });
});
