import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../../server.ts";

const TV_01_ID = "afc232be-a390-4eb8-b789-dfae70edd9fd";
const TV_02_ID = "9e07624a-0c9e-4e6c-91d8-703b5931f30b";
const CAMPAIGN_WITH_DATA = "3dfa2870-128a-4059-84d0-3094e1e1b153";
const CAMPAIGN_EMPTY = "69dcc5ef-23ff-40f2-85a2-e6a1ed25399a";

let adminToken = "";

beforeAll(async () => {
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

  it("deve filtrar responses por terminal_id (TV-01)", async () => {
    const res = await request(app)
      .get(`/api/responses?terminal_id=${TV_01_ID}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(7);

    for (const r of res.body) {
      expect(r.terminal_id).toBe(TV_01_ID);
    }
  });

  it("deve retornar vazio para terminal sem responses (TV-02)", async () => {
    const res = await request(app)
      .get(`/api/responses?terminal_id=${TV_02_ID}`)
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
      .get(`/api/responses?terminal_id=${TV_01_ID}&startDate=2026-07-03&endDate=2026-07-03`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(7);
    for (const r of res.body) {
      expect(r.terminal_id).toBe(TV_01_ID);
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
      .get(`/api/campaigns/${CAMPAIGN_WITH_DATA}/evolution?days=7&terminal_id=${TV_01_ID}`)
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
      .get(`/api/campaigns/${CAMPAIGN_WITH_DATA}/evolution?startDate=2026-07-03&endDate=2026-07-03&terminal_id=${TV_01_ID}`)
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
