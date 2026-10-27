import dotenv from "dotenv";

dotenv.config();

// Diagnóstico do Supabase Storage, sem imprimir chaves.
// Uso: npx tsx scripts/check-supabase.ts
// Lê SUPABASE_URL e SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY do .env ou do ambiente.

const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || "";
const key = serviceKey || anonKey;
const configured = (process.env.SUPABASE_STORAGE_BUCKET || "").trim();
const candidates = [...new Set([configured, "uploads", "medias"].filter(Boolean))];

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

function jwtRole(token: string): string {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
    return `${payload.role ?? "?"} (ref ${payload.ref ?? "?"})`;
  } catch {
    return "não é um JWT";
  }
}

function headers(authKey: string) {
  return { apikey: authKey, Authorization: `Bearer ${authKey}` };
}

async function listBuckets(): Promise<void> {
  if (!serviceKey) {
    console.log("• listagem de buckets: pulada (precisa de service_role)");
    return;
  }
  const res = await fetch(`${url}/storage/v1/bucket`, { headers: headers(serviceKey) });
  if (!res.ok) {
    console.log(`• listagem de buckets: HTTP ${res.status} — ${await res.text()}`);
    return;
  }
  const buckets = (await res.json()) as Array<{ name: string; public: boolean }>;
  console.log(`• buckets no projeto: ${buckets.map((b) => `${b.name}${b.public ? " (público)" : ""}`).join(", ") || "nenhum"}`);
}

async function probeBucket(bucket: string): Promise<boolean> {
  const path = `diagnostico/${Date.now()}-check.png`;
  const res = await fetch(`${url}/storage/v1/object/${bucket}/${path}`, {
    method: "POST",
    headers: { ...headers(key), "Content-Type": "image/png", "x-upsert": "true" },
    body: PNG_1X1,
  });

  if (!res.ok) {
    console.log(`✗ ${bucket}: upload falhou (HTTP ${res.status}) — ${await res.text()}`);
    return false;
  }

  await fetch(`${url}/storage/v1/object/${bucket}/${path}`, {
    method: "DELETE",
    headers: headers(key),
  }).catch(() => undefined);

  const publicUrl = `${url}/storage/v1/object/public/${bucket}/${path}`;
  console.log(`✓ ${bucket}: upload OK (imagem de teste removida)`);
  console.log(`  URL pública de exemplo: ${publicUrl}`);
  return true;
}

async function main() {
  console.log("== Supabase Storage: diagnóstico ==");
  if (!url) {
    console.error("✗ SUPABASE_URL não definido.");
    process.exit(1);
  }
  console.log(`• projeto: ${new URL(url).hostname}`);
  if (!key) {
    console.error("✗ Nenhuma chave definida (SUPABASE_SERVICE_ROLE_KEY ou SUPABASE_ANON_KEY).");
    process.exit(1);
  }
  console.log(`• chave usada: ${serviceKey ? "service_role" : "anon"} — ${jwtRole(key)}`);
  if (configured) console.log(`• SUPABASE_STORAGE_BUCKET: ${configured}`);

  await listBuckets();

  let ok = false;
  for (const bucket of candidates) {
    ok = (await probeBucket(bucket)) || ok;
  }

  if (!ok) {
    console.error(
      "\n✗ Nenhum bucket aceitou upload. Verifique: (1) nome do bucket, (2) bucket público, " +
        "(3) SUPABASE_SERVICE_ROLE_KEY definida no backend (bypassa RLS), (4) chave revogada/expirada.",
    );
    process.exit(1);
  }
  console.log("\n✓ Storage operacional. Fixe o bucket que funcionou em SUPABASE_STORAGE_BUCKET.");
}

main().catch((err) => {
  console.error("✗ Falha no diagnóstico:", err);
  process.exit(1);
});
