# Changelog — 27/07/2026

## Correção: Sincronização Offline no SurveyOffline

### Problema
O `/survey-offline` salvava respostas no IndexedDB quando offline, mas a sincronização
automática ao voltar online não funcionava de forma confiável.

### Causas identificadas e corrigidas

**1. try-catch externo + `finally` com `setSyncing(false)`**
- `syncResponses()` podia travar o estado `syncing` em `true` se ocorresse um erro
  inesperado, impedindo futuras tentativas de sync
- Agora `setSyncing(false)` está no `finally`, garantindo que sempre execute

**2. Sync imediato ao voltar online**
- Não havia trigger quando `isOnline` mudava de `false → true`
- Agora um `useEffect` com `prevOnlineRef` detecta a transição e dispara sync imediato

**3. Sync na montagem inicial**
- Se o app abria já online, o sync nunca disparava (só no próximo intervalo de 30s)
- Agora o `mountedRef` faz o sync rodar já no primeiro carregamento

**4. Health-check real de conectividade**
- `navigator.onLine` é notoriamente não confiável (falso positivo quando WiFi sem internet)
- Substituído por `HEAD /api/health` a cada 15s com `AbortController` compatível
  com WebViews Android antigas (não usa `AbortSignal.timeout`)

**5. `setAuthToken()` no login do terminal**
- O token JWT era salvo apenas em `localStorage`, sem chamar `setAuthToken()` da lib api
- Agora usa `setAuthToken()` que atualiza tanto a variável em memória quanto o localStorage

**6. Removido `break` no loop de sync**
- Se um item da fila falhasse, os demais não eram sequer tentados
- Agora o loop continua para o próximo item

**7. Reordenamento da função `syncResponses`**
- Movida para antes dos `useEffect` que a referenciam, evitando temporal dead zone (TDZ)

### Arquivos alterados no front-end

- `src/pages/SurveyOffline.tsx` — todas as correções acima

---

## Cache do index.html (Servidor)

### Problema
O Android WebView servia o `index.html` velho do cache HTTP, impedindo que o
JavaScript das correções fosse carregado.

### Correção
- Adicionado header `Cache-Control: no-cache, must-revalidate, proxy-revalidate`
  no `index.html` servido pelo Express
- Arquivos JS/CSS com hash no nome continuam com cache longo (1 ano)
- O `index.html` SEMPRE revalida com o servidor antes de usar cache

### Arquivo alterado

- `server.ts` — `express.static` com `setHeaders` + `app.get("*")` com cache header

---

## Android WebView (APK)

### Problema
Mesmo com o header `no-cache`, WebViews Android com `LOAD_DEFAULT` podem não
revalidar corretamente o cache em todos os cenários.

### Correção
- `webView.clearCache(true)` chamado em `loadLastUrl()` — sempre que o app carrega a página
- `webView.clearCache(true)` chamado em `onResume()` — quando o usuário retorna ao app
- `clearCache(true)` limpa APENAS o cache HTTP (HTML/JS/CSS)
- **IndexedDB (respostas pendentes) NÃO é afetado**

### Arquivo alterado

- `app/src/main/java/com/beend/survey/MainActivity.kt`

### APK atualizado
- `public/bee-off.apk` — novo APK com as correções
- Instalar por cima do existente (preserva IndexedDB)
- Download: `https://totem.beend.tech/bee-off.apk`

---

## Fluxo completo após as correções

```
App inicia com internet
  → clearCache(true) limpa HTTP cache
  → Servidor retorna index.html com header no-cache
  → JS novo carrega com as correções de sync
  → syncResponses() lê IndexedDB
  → Encontra respostas synced: 0
  → POST /api/responses para cada resposta
  → Marca como synced: 1 no IndexedDB
  → Dados sincronizados sem perda

App inicia sem internet
  → clearCache(true) não é chamado
  → Cache HTTP existente é usado
  → Survey funciona offline
  → Quando internet voltar → clearCache + sync imediato
```
