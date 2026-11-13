import { describe, it, expect, beforeAll, vi } from "vitest";
import express from "express";
import request from "supertest";

// Regressão do incidente: 20 erros de QUALQUER conta esgotavam a cota do IP
// inteiro por 15 min (redes com NAT: um usuário errando a senha bloqueava todos).
// Agora a cota é por conta + IP, e erros de validação/servidor não contam.

const MAX = 5; // reduzido no teste para não disparar 20+ requisições

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret-para-rate-limit";
process.env.ADMIN_PASSWORD = "test-admin-password";
process.env.DATABASE_URL = "postgresql://user:pass@127.0.0.1:5432/test";
process.env.SUPABASE_URL = "https://abcdefghijklmnopqrst.supabase.co";
process.env.SUPABASE_ANON_KEY = "test-anon-key";
process.env.AUTH_RATE_LIMIT_MAX = String(MAX);
process.env.AUTH_IP_RATE_LIMIT_MAX = "100";

type Limiters = {
  authIpLimiter: express.RequestHandler;
  authLimiter: express.RequestHandler;
};

async function loadLimiters(): Promise<Limiters> {
  vi.resetModules();
  return import("../src/server/deps");
}

// Simula o handler real de login: 401 para senha errada, 400 para payload
// inválido, 500 para falha de banco e 200 para credencial correta.
function buildApp(limiters: Limiters) {
  const app = express();
  app.use(express.json());
  app.set("trust proxy", false);
  app.post(
    "/api/auth/login",
    limiters.authIpLimiter,
    limiters.authLimiter,
    (req: express.Request, res: express.Response) => {
      const { email, password } = req.body ?? {};
      if (typeof email !== "string" || typeof password !== "string") {
        return res.status(400).json({ error: "dados inválidos" });
      }
      if (password === "falha-banco") return res.status(500).json({ error: "banco indisponível" });
      if (password === "senha-certa") return res.json({ ok: true });
      return res.status(401).json({ error: "Credenciais inválidas" });
    },
  );
  return app;
}

function login(app: express.Express, email: string, password: string) {
  return request(app).post("/api/auth/login").send({ email, password });
}

describe("rate limit de login", () => {
  let limiters: Limiters;
  let app: express.Express;

  beforeAll(async () => {
    limiters = await loadLimiters();
    app = buildApp(limiters);
  });

  it("bloqueia a conta que errou a senha, mas não outra conta na mesma rede", async () => {
    for (let i = 0; i < MAX; i++) {
      const res = await login(app, "a@beend.tech", "senha-errada");
      expect(res.status).toBe(401);
    }

    // A conta A esgotou a cota: nem com a senha correta entra.
    const blocked = await login(app, "a@beend.tech", "senha-certa");
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toMatch(/esta conta/i);

    // A conta B, do MESMO IP, continua entrando normalmente.
    const other = await login(app, "b@beend.tech", "senha-certa");
    expect(other.status).toBe(200);
  });

  it("não gasta a cota com erros 400 (validação) nem 5xx (banco fora)", async () => {
    const fresh = await loadLimiters();
    const freshApp = buildApp(fresh);

    for (let i = 0; i < 10; i++) {
      expect((await login(freshApp, "c@beend.tech", "falha-banco")).status).toBe(500);
      // Sem senha: handler responde 400 antes de checar credencial.
      const invalid = await request(freshApp)
        .post("/api/auth/login")
        .send({ email: "c@beend.tech" });
      expect(invalid.status).toBe(400);
    }

    // Se 400/5xx tivessem consumido cota, o primeiro 401 já viria 429.
    for (let i = 0; i < MAX; i++) {
      const res = await login(freshApp, "c@beend.tech", "senha-errada");
      expect(res.status).toBe(401);
    }

    const blocked = await login(freshApp, "c@beend.tech", "senha-certa");
    expect(blocked.status).toBe(429);
  });
});
