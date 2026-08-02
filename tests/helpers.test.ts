import { describe, it, expect } from "vitest";
import request from "supertest";
import { app, parseCampaignList } from "../server.ts";

describe("parseCampaignList", () => {
  it("retorna array vazio para valores vazios/indefinidos", () => {
    expect(parseCampaignList(null)).toEqual([]);
    expect(parseCampaignList(undefined)).toEqual([]);
    expect(parseCampaignList("")).toEqual([]);
    expect(parseCampaignList("   ")).toEqual([]);
  });

  it("parseia CSV com vírgulas", () => {
    expect(parseCampaignList("A,B,C")).toEqual(["A", "B", "C"]);
    expect(parseCampaignList(" A , B ")).toEqual(["A", "B"]);
  });

  it("parseia JSON array", () => {
    expect(parseCampaignList('["A","B"]')).toEqual(["A", "B"]);
  });

  it("ignora itens não-string em arrays", () => {
    expect(parseCampaignList('[1, "A", null]')).toEqual(["A"]);
    expect(parseCampaignList(["A", 2, {}])).toEqual(["A"]);
  });

  it("cai para CSV se o JSON for inválido", () => {
    expect(parseCampaignList('["A", "B"')).toEqual(['["A"', '"B"']);
  });

  it("retorna array vazio para tipos não esperados", () => {
    expect(parseCampaignList(42)).toEqual([]);
    expect(parseCampaignList({})).toEqual([]);
  });
});

describe("GET /api/health", () => {
  it("responde ok com database checada", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.database).toBe("ok");
  });
});
