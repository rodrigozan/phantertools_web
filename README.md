# Phanter Tools web

## Produção — phantertools.com

`npm run build` gera o frontend na raiz (`/`). Execute `npm start` para servir
`dist/` e encaminhar `/api/*` e `/public/*` para a API no VPS. A porta vem de
`PORT`; `API_UPSTREAM_URL` define o backend (padrão: o Funnel existente em
`https://phanterai.tailc5aaf7.ts.net:10000/ig`). Não coloque segredos em variáveis
`VITE_*`: elas são incluídas no JavaScript público.

Na Hostinger, use uma aplicação **Node.js**, build `npm run build`, entrada
`server.mjs`, com os arquivos fonte e `dist` disponíveis no runtime. O modo Vite
estático com apenas `dist` resolve os assets, mas não executa o proxy de API.
Mantenha o deploy automático ligado ao branch `master`.

Na API, configure `PUBLIC_BASE_URL=https://phantertools.com` e reinicie o serviço.
O cookie de sessão passa a usar `/`. Login, callbacks OAuth e mídia pública usam
esse domínio; não é necessário CORS nem cookies de terceiros.

Cadastre também nos provedores OAuth as URLs autorizadas:

- `https://phantertools.com/api/auth/google/callback`
- `https://phantertools.com/api/auth/facebook/callback`
- `https://phantertools.com/api/instagram/callback`
- `https://phantertools.com/api/analysis/facebook/callback`

O webhook da Meta pode continuar no Funnel existente; se migrar, use
`https://phantertools.com/api/webhooks/instagram`.

## Desenvolvimento e painel legado

`npm run dev` encaminha `/api`, `/public`, `/ig/api` e `/ig/public` para
`http://127.0.0.1:3930`. Para gerar o painel servido pelo backend em `/ig/`, use
`VITE_BASE_PATH=/ig/ npm run build`. O build padrão é o da Hostinger na raiz.

`npm test` valida os assets, fallback do roteador e proxy de cookies, uploads e
redirecionamentos sem chamar serviços externos.
