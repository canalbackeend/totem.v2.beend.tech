import crypto from "crypto";
import dns from "node:dns/promises";
import { supabase, authenticateToken, supabaseServiceKey, supabaseStorageBucket, supabaseUrl, supabaseHost } from "./deps";

// Upload de imagens para o Supabase Storage.
// O bucket é resolvido em tempo de execução: SUPABASE_STORAGE_BUCKET quando definido,
// senão tenta os nomes usados nos projetos beend.tech ("uploads" e "medias").
// SVG é vetor de stored-XSS (pode embutir scripts) e foi removido.
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

const FALLBACK_BUCKETS = ["uploads", "medias"];
const BUCKET_CANDIDATES = [...new Set([supabaseStorageBucket.trim(), ...FALLBACK_BUCKETS].filter(Boolean))];

// Bucket que funcionou de fato (cacheado após o primeiro upload bem-sucedido).
let resolvedBucket: string | null = null;
const ensuredBuckets = new Set<string>();

// Último erro de upload, para o /api/health mostrar a causa real em produção.
let lastUploadError: { at: string; message: string } | null = null;

// Resolução DNS do host do Supabase, com cache de 60s (evita lookup por upload).
let dnsState: { ok: boolean; detail: string; at: number } | null = null;

async function checkSupabaseDns(force = false) {
  if (!force && dnsState && Date.now() - dnsState.at < 60_000) return dnsState;
  if (!supabaseHost) {
    dnsState = {
      ok: false,
      detail: `SUPABASE_URL inválida ("${supabaseUrl || "vazia"}") — use https://<ref>.supabase.co`,
      at: Date.now(),
    };
    return dnsState;
  }
  try {
    await dns.lookup(supabaseHost);
    dnsState = { ok: true, detail: "ok", at: Date.now() };
  } catch (err: any) {
    dnsState = { ok: false, detail: `${err?.code || "falha"} ao resolver ${supabaseHost}`, at: Date.now() };
  }
  return dnsState;
}

/** Estado do Storage para diagnóstico (sem expor chaves). */
export function getStorageStatus() {
  return {
    configured: Boolean(supabase),
    key: supabaseServiceKey ? "service_role" : "anon",
    host: supabaseHost || null,
    bucket: resolvedBucket ?? (supabaseStorageBucket.trim() || BUCKET_CANDIDATES[0]),
    candidates: BUCKET_CANDIDATES,
    dns: dnsState ? dnsState.detail : "não verificado",
    lastError: lastUploadError,
  };
}

function isMissingBucket(message: string): boolean {
  return /bucket.*not found|not found.*bucket|does not exist|não existe/i.test(message);
}

// A chave anon não tem permissão para ler/criar buckets; só a service_role cria.
async function ensureBucket(bucket: string): Promise<void> {
  if (!supabase || !supabaseServiceKey || ensuredBuckets.has(bucket)) return;
  try {
    const { data } = await supabase.storage.getBucket(bucket);
    if (!data) {
      await supabase.storage.createBucket(bucket, { public: true });
    }
    ensuredBuckets.add(bucket);
  } catch (err) {
    // Ignora: o upload abaixo reporta o erro real (ex.: RLS com a chave anon).
    console.warn(`Não foi possível garantir o bucket '${bucket}' no Supabase:`, err);
  }
}

/** Falha rápido e com causa clara quando o host do Supabase não resolve (DNS). */
async function assertSupabaseReachable(): Promise<void> {
  const state = await checkSupabaseDns();
  if (!state.ok) {
    const message =
      `Supabase inacessível: ${state.detail}. Confira SUPABASE_URL no ambiente do servidor ` +
      `(sem espaços, aspas ou barra no final) e a saída de rede/DNS do container.`;
    throw new Error(message);
  }
}

async function uploadBase64ToSupabase(base64Str: string, folder: string): Promise<string> {
  if (!supabase) {
    throw new Error(
      "Supabase não está configurado. Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (ou SUPABASE_ANON_KEY) nas variáveis de ambiente.",
    );
  }

  await assertSupabaseReachable();

  // Sanitize folder
  const safeFolder = (folder || "geral").replace(/[^a-zA-Z0-9_-]/g, '');

  // Parse the base64 string
  const matches = base64Str.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    if (base64Str.startsWith("http")) {
      return base64Str;
    }
    throw new Error("Formato de imagem inválido. Deve ser um base64 válido.");
  }

  const mimeType = matches[1];
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    throw new Error("Tipo de arquivo não permitido. Use apenas JPEG, PNG, GIF ou WebP.");
  }

  const buffer = Buffer.from(matches[2], 'base64');
  if (buffer.length > MAX_IMAGE_SIZE) {
    throw new Error("Imagem muito grande. O tamanho máximo é 5MB.");
  }

  let ext = "png";
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) ext = "jpg";
  else if (mimeType.includes("gif")) ext = "gif";
  else if (mimeType.includes("webp")) ext = "webp";

  const filename = `${safeFolder}/${Date.now()}-${crypto.randomBytes(16).toString('hex')}.${ext}`;

  const candidates = resolvedBucket ? [resolvedBucket] : BUCKET_CANDIDATES;
  const attempted: string[] = [];
  let lastError: Error | null = null;

  for (const bucket of candidates) {
    attempted.push(bucket);
    await ensureBucket(bucket);

    const { error } = await supabase.storage
      .from(bucket)
      .upload(filename, buffer, {
        contentType: mimeType,
        cacheControl: "3600",
      });

    if (!error) {
      if (resolvedBucket !== bucket) {
        resolvedBucket = bucket;
        if (bucket !== supabaseStorageBucket.trim()) {
          console.warn(
            `Supabase Storage: usando o bucket '${bucket}'. Defina SUPABASE_STORAGE_BUCKET='${bucket}' para fixar.`,
          );
        }
      }
      const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(filename);
      return publicUrl;
    }

    // "fetch failed" esconde a causa (DNS, TLS, proxy). Traduz para algo acionável.
    const isNetwork = /fetch failed|ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ETIMEDOUT|certificate/i.test(error.message);
    lastError = new Error(
      isNetwork
        ? `falha de rede ao conectar em ${supabaseHost || supabaseUrl} (${error.message})`
        : error.message,
    );

    if (!isMissingBucket(error.message)) break; // permissão/tamanho: não adianta trocar de bucket
  }

  throw new Error(
    `Erro ao enviar para o Supabase Storage (bucket tentado: ${attempted.join(", ")}): ${lastError?.message ?? "erro desconhecido"}`,
  );
}

// Proxy endpoint to download and serve images with CORS headers (public for PDF logos)
const ALLOWED_PROXY_DOMAINS = supabaseHost ? [supabaseHost] : [];

export function registerUploadRoutes(app: any) {
  app.post("/api/upload", authenticateToken, async (req: any, res: any) => {
    const { image, folder } = req.body;
    if (!image) {
      return res.status(400).json({ error: "Imagem em formato base64 é obrigatória" });
    }
    try {
      const url = await uploadBase64ToSupabase(image, folder || "geral");
      lastUploadError = null;
      res.json({ url });
    } catch (err: any) {
      console.error("Upload error:", err);
      lastUploadError = { at: new Date().toISOString(), message: err.message || String(err) };
      res.status(500).json({ error: err.message || "Erro ao fazer upload da imagem." });
    }
  });

  app.get("/api/proxy-image", async (req: any, res: any) => {
    const { url } = req.query;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: "Parâmetro url é obrigatório" });
    }
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return res.status(400).json({ error: "URL inválida" });
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return res.status(400).json({ error: "Protocolo não permitido" });
    }
    if (!ALLOWED_PROXY_DOMAINS.some((d) => parsed.hostname === d)) {
      return res.status(403).json({ error: "Domínio não autorizado" });
    }
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status}`);
      }
      const contentType = response.headers.get("content-type") || "image/png";
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      res.setHeader("Content-Type", contentType);
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Cache-Control", "public, max-age=86400"); // Cache for 1 day
      res.end(buffer);
    } catch (err: any) {
      console.error("Error proxying image:", err);
      res.status(500).json({ error: err.message });
    }
  });
}
