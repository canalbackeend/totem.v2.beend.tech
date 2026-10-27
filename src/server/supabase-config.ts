// Validação da configuração do Supabase, isolada de efeitos colaterais para
// poder ser testada. Cobre o incidente real: SUPABASE_URL apontando para um
// projeto e a chave sendo de outro (upload falhava com "fetch failed").

export type SupabaseConfig = {
  url: string;
  host: string;
  keyRole: string | null;
  keyRef: string | null;
  errors: string[];
  warnings: string[];
};

/** Remove espaços, aspas e barra final que quebram a URL silenciosamente. */
export function normalizeSupabaseUrl(raw: string | undefined | null): string {
  return (raw || "").trim().replace(/^["']|["']$/g, "").replace(/\/+$/, "");
}

/** Hostname da URL, ou "" quando a URL é inválida. */
export function parseSupabaseHost(url: string): string {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return "";
    return parsed.hostname;
  } catch {
    return "";
  }
}

/** Lê role/ref do payload de uma chave JWT (legado anon/service). */
export function decodeSupabaseKey(key: string): { role: string | null; ref: string | null } | null {
  const parts = (key || "").trim().split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    return { role: payload.role ?? null, ref: payload.ref ?? null };
  } catch {
    return null;
  }
}

/** "abc.supabase.co" -> "abc"; outros hosts -> null. */
export function projectRefFromHost(host: string): string | null {
  const match = host.match(/^([a-z0-9-]+)\.supabase\.(co|in)$/i);
  return match ? match[1] : null;
}

export function inspectSupabaseConfig(input: {
  url: string | undefined | null;
  anonKey?: string;
  serviceKey?: string;
}): SupabaseConfig {
  const url = normalizeSupabaseUrl(input.url);
  const host = parseSupabaseHost(url);
  const key = (input.serviceKey || input.anonKey || "").trim();
  const decoded = key ? decodeSupabaseKey(key) : null;

  const errors: string[] = [];
  const warnings: string[] = [];

  if (!url) {
    warnings.push(
      "SUPABASE_URL não definida; upload de imagens (Supabase Storage) estará desativado.",
    );
  } else if (/[<>]/.test(url)) {
    errors.push(
      `SUPABASE_URL ainda é o placeholder ("${url}"). Copie a URL real do painel do Supabase.`,
    );
  } else if (!host) {
    errors.push(
      `SUPABASE_URL inválida ("${url}"). Use https://<project-ref>.supabase.co, sem espaços, aspas nem caminho.`,
    );
  } else {
    const urlRef = projectRefFromHost(host);
    if (decoded?.ref && urlRef && decoded.ref !== urlRef) {
      errors.push(
        `A chave do Supabase é do projeto "${decoded.ref}", mas a SUPABASE_URL aponta para "${urlRef}". ` +
          "Use a URL e a chave do MESMO projeto.",
      );
    }
  }

  if (!key) {
    errors.push(
      "Nenhuma chave do Supabase definida. Configure SUPABASE_SERVICE_ROLE_KEY (recomendado) ou SUPABASE_ANON_KEY.",
    );
  } else if (decoded && !decoded.ref) {
    warnings.push("A chave do Supabase não expõe o projeto (formato novo); não é possível conferir a URL.");
  }

  if (!input.serviceKey) {
    warnings.push(
      "SUPABASE_SERVICE_ROLE_KEY não definida; usando a chave anon. Uploads dependem das policies de RLS do bucket.",
    );
  }

  return {
    url,
    host,
    keyRole: decoded?.role ?? null,
    keyRef: decoded?.ref ?? null,
    errors,
    warnings,
  };
}
