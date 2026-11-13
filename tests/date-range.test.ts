import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";

// Regressão do incidente "o sistema cai ao usar os filtros": o <input type="date">
// do Chrome emite o ano parcial enquanto o cliente digita (0002, 0020, 0202...).
// O endpoint de evolução criava um bucket por dia do intervalo — 739 mil dias
// para 0002-11-01 — e bloqueava o event loop por ~70s, derrubando o healthcheck.

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret-para-date-range";
process.env.ADMIN_PASSWORD = "test-admin-password";
// Porta fechada: o banco falha rápido. O auth middleware é fail-open em erro de
// banco, então a requisição chega até a validação de datas sem Postgres.
process.env.DATABASE_URL = "postgresql://user:pass@127.0.0.1:1/test";
process.env.ENABLE_DAILY_REPORTS = "false";

let app: any;
let token = "";
let validateDateRange: typeof import("../src/server/date-range").validateDateRange;
let MAX_FILTER_RANGE_DAYS: number;
let toISODate: (d: Date | string) => string;

beforeAll(async () => {
  ({ validateDateRange, MAX_FILTER_RANGE_DAYS } = await import("../src/server/date-range"));
  ({ toISODate } = await import("../src/server/deps"));
  ({ app } = await import("../src/server/app"));
  token = jwt.sign({ id: "user-1", email: "cliente@example.com" }, process.env.JWT_SECRET!);
});

describe("validateDateRange", () => {
  it("aceita filtros vazios", () => {
    expect(validateDateRange(undefined, undefined)).toBeNull();
    expect(validateDateRange("", "")).toBeNull();
  });

  it("aceita um intervalo de até 120 dias", () => {
    expect(MAX_FILTER_RANGE_DAYS).toBe(120);
    expect(validateDateRange("2026-01-01", "2026-04-30")).toBeNull(); // 120 dias
    expect(validateDateRange("2026-07-03", "2026-07-03")).toBeNull();
  });

  it("rejeita intervalo maior que 120 dias", () => {
    expect(validateDateRange("2026-01-01", "2026-05-01")).toMatch(/120 dias/);
  });

  it("rejeita ano parcial digitado no input de data", () => {
    for (const partial of ["0002-11-01", "0020-11-01", "0202-11-01"]) {
      expect(validateDateRange(partial, "2026-11-01")).not.toBeNull();
    }
  });

  it("rejeita ano com mais de 4 dígitos e formatos inválidos", () => {
    expect(validateDateRange("2026-11-01", "275760-01-01")).not.toBeNull();
    expect(validateDateRange("abc", undefined)).not.toBeNull();
    expect(validateDateRange("2026-02-30", undefined)).not.toBeNull();
    expect(validateDateRange(["2026-01-01", "2026-01-02"] as any, undefined)).not.toBeNull();
  });

  it("rejeita início depois do fim", () => {
    expect(validateDateRange("2026-05-01", "2026-04-01")).toMatch(/inicial/);
  });

  it("só com data inicial, mede o intervalo até hoje", () => {
    const today = new Date();
    const old = new Date(today.getTime() - 200 * 86400000).toISOString().slice(0, 10);
    const recent = new Date(today.getTime() - 30 * 86400000).toISOString().slice(0, 10);
    expect(validateDateRange(old, undefined)).toMatch(/120 dias/);
    expect(validateDateRange(recent, undefined)).toBeNull();
  });
});

describe("GET /api/campaigns/:id/evolution com intervalo absurdo", () => {
  it("responde 400 rápido em vez de travar o servidor", async () => {
    const started = Date.now();
    const res = await request(app)
      .get("/api/campaigns/qualquer/evolution?days=7&startDate=0002-11-01")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(Date.now() - started).toBeLessThan(3000);
  });

  it("/api/responses também rejeita o intervalo", async () => {
    const res = await request(app)
      .get("/api/responses?campaign_id=x&all=true&startDate=2026-01-01&endDate=2026-12-31")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
});

describe("toISODate", () => {
  it("é barato o bastante para rodar em laço (reusa o formatter)", () => {
    const started = Date.now();
    for (let i = 0; i < 50_000; i++) toISODate(new Date(1_700_000_000_000 + i * 86400000));
    expect(Date.now() - started).toBeLessThan(1500);
  });

  it("mantém a âncora em BRT", () => {
    expect(toISODate("2026-07-04T02:30:00.000Z")).toBe("2026-07-03");
  });
});
