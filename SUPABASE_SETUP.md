# Guia de integração com o Supabase

Este projeto usa o Supabase em duas frentes:

1. **PostgreSQL** como banco de dados principal (via Prisma).
2. **Supabase Storage** para imagens de logos, campanhas, produtos etc.

## 1. Banco de dados (Prisma + Supabase)

Configure no `.env` (veja `.env.example`):

- `DATABASE_URL`: conexão **pooler** (porta 6543) com `?pgbouncer=true&connection_limit=1`
  para não esgotar as conexões do Supabase quando houver mais de uma instância.

## 2. Storage (bucket)

O backend resolve o bucket em tempo de execução:

1. usa `SUPABASE_STORAGE_BUCKET` quando definido;
2. senão tenta `uploads` e depois `medias` (nomes usados nos projetos beend.tech);
3. fixa o bucket que funcionou e loga um aviso sugerindo a variável.

A chave usada é `SUPABASE_SERVICE_ROLE_KEY` (preferida, bypassa RLS) ou, na falta dela,
`SUPABASE_ANON_KEY`.

> Se nenhuma chave de serviço estiver definida, o upload depende de policies de RLS
> em `storage.objects`. Em produção use sempre a `service_role` no backend.

Passos no painel do Supabase (Storage → Buckets):

1. Garantir que o bucket esteja **público**.
2. (Recomendado) Definir `SUPABASE_SERVICE_ROLE_KEY` no ambiente do backend.
3. Se usar a chave anon, criar policies em `storage.objects`:
   - Leitura pública: `SELECT` para `anon`/`public`.
   - Escrita: `INSERT`/`UPDATE`/`DELETE`.

## 3. Diagnóstico rápido

Na raiz do projeto (com o `.env` preenchido):

```bash
npx tsx scripts/check-supabase.ts
```

O script mostra o projeto, o tipo de chave (sem imprimir a chave), lista os buckets
(quando há `service_role`) e faz um upload de teste de 1x1 px em cada bucket candidato,
removendo a imagem em seguida. Ele termina com código 1 se nenhum bucket aceitar upload.

Em produção, `GET /api/health` traz o bloco `storage`:

```json
{ "configured": true, "key": "service_role", "bucket": "uploads", "candidates": ["uploads", "medias"] }
```

## 4. Proxy de imagens (CSP/CORS)

O endpoint `/api/proxy-image` só permite o host do `SUPABASE_URL`. Se apontar o Storage
para outro host, atualize `ALLOWED_PROXY_DOMAINS` em `src/server/uploads.ts`.

## 5. Problemas comuns

- **"Supabase não está configurado"**: falta `SUPABASE_URL` e/ou chave.
- **"new row violates row-level security policy"**: chave anon sem policy de insert;
  use `SUPABASE_SERVICE_ROLE_KEY` ou crie a policy.
- **"Bucket not found"**: nome do bucket diferente. Defina `SUPABASE_STORAGE_BUCKET`
  com o nome real (o código tenta `uploads` e `medias` automaticamente).
- **Imagens 403/404**: bucket não é público ou falta policy de leitura.
- **Upload 500 mesmo com credenciais "certas"**: confira se a chave não foi revogada
  e se o projeto do Supabase é o mesmo do painel (ref do JWT em `/api/health`).
