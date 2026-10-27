# Guia de integração com o Supabase

Este projeto usa o Supabase em duas frentes:

1. **PostgreSQL** como banco de dados principal (via Prisma).
2. **Supabase Storage** (bucket `uploads`) para imagens de logos, campanhas, produtos etc.

## 1. Banco de dados (Prisma + Supabase)

Configure no `.env` (veja `.env.example`):

- `DATABASE_URL`: conexão **pooler** (porta 6543) com `?pgbouncer=true&connection_limit=1`.
  Usada em runtime para não esgotar as conexões do Supabase.
- `DIRECT_URL`: conexão **direta** (porta 5432) usada por `prisma db push`/`migrate`.

> Sem `DIRECT_URL`, o fallback no Docker é `DATABASE_URL`. Em produção é recomendado
> definir as duas para evitar erros de prepared statements no PgBouncer.

## 2. Storage (bucket `uploads`)

O bucket padrão deste projeto é **`uploads`** (pode ser trocado via variável
`SUPABASE_STORAGE_BUCKET`, ex.: `medias`). O backend faz upload usando a chave
configurada (`SUPABASE_SERVICE_ROLE_KEY` com prioridade; caso contrário a anon).

> Confirme no painel qual é o nome real do bucket do seu projeto. O código usa
> `uploads` por padrão; se o seu bucket se chama `medias`, defina
> `SUPABASE_STORAGE_BUCKET="medias"`.

Passos no painel do Supabase (Storage → Buckets):

1. Garantir que o bucket (`uploads`) esteja **público**.
2. (Recomendado) Usar `SUPABASE_SERVICE_ROLE_KEY` no backend, nunca no frontend.
3. Se usar a chave anon, o bucket precisa de policies em `storage.objects`:
   - Leitura pública: `SELECT` para `anon`/`public` no bucket `uploads`.
   - Escrita: `INSERT`/`UPDATE`/`DELETE` para o bucket.

Exemplo de diagnóstico rápido (substitua `ANON` pela sua chave):

```bash
curl -s https://<project-ref>.supabase.co/storage/v1/object/uploads/teste.png \
  -H "Authorization: Bearer ANON" -H "apikey: ANON" \
  -X POST -H "Content-Type: image/png" --data-binary @arquivo.png
# HTTP 200 => bucket e policies OK.
```

SQL de exemplo (RLS), se você ainda não tiver policies de escrita para anon:

```sql
create policy "uploads leitura pública"
  on storage.objects for select
  using (bucket_id = 'uploads');

create policy "uploads escrita anon"
  on storage.objects for insert
  to anon
  with check (bucket_id = 'uploads');

create policy "uploads update anon"
  on storage.objects for update
  to anon
  using (bucket_id = 'uploads');

create policy "uploads delete anon"
  on storage.objects for delete
  to anon
  using (bucket_id = 'uploads');
```

## 3. Proxy de imagens (CSP/CORS)

O endpoint `/api/proxy-image` só permite domínios do `SUPABASE_URL`. Se você apontar o
Storage para outro host, atualize `ALLOWED_PROXY_DOMAINS` em `src/server/uploads.ts`.

## 4. Verificação

- `GET /api/health` retorna `supabase: "configured"` quando as variáveis estão definidas.
- Teste de upload: crie/editar uma empresa ou campanha e envie uma imagem.
- Em caso de erro, verifique os logs do servidor: normalmente é bucket inexistente ou RLS.

## 5. Problemas comuns

- **"Supabase não está configurado"**: faltam `SUPABASE_URL` e/ou chave.
- **"new row violates row-level security policy"**: está usando a chave anon sem policy de insert;
  use `SUPABASE_SERVICE_ROLE_KEY` ou crie a policy.
- **"Bucket not found"**: o nome do bucket no código não bate com o do projeto. Defina
  `SUPABASE_STORAGE_BUCKET="<nome-real>"` ou crie um bucket com o nome esperado.
- **Images 403/404**: bucket não é público ou policy de select ausente.
- **DB connection errors (Prisma)**: use o pooler em `DATABASE_URL` e evite muitas instâncias.

## 6. "fetch failed" / "hostname could not be found"

Esse erro não é do bucket: o servidor (ou o navegador) não conseguiu resolver o host do
Supabase. Confira `SUPABASE_URL` no ambiente — espaço, aspas, barra no final ou o
placeholder `https://<project-ref>.supabase.co` quebram o upload. O `/api/health` mostra
`storage.host` e `storage.dns`; o script `check-supabase.ts` faz o teste de DNS.
