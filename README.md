# Phanter Tools web

Frontend React estático. A Hostinger executa `yarn build` e publica `dist/`.
O arquivo `public/.htaccess` é copiado para `dist/` e faz o fallback das rotas
React para `index.html` na Hostinger, inclusive ao recarregar ou abrir links diretos.

O navegador acessa diretamente a API HTTPS existente no VPS:
`https://api.phantertools.com/ig/api`.
Não há servidor Node nem proxy de produção no frontend.

As páginas públicas de Termos de Serviço e Política de Privacidade ficam em
`/termos-de-servico` e `/politica-de-privacidade`. Elas não exigem login; seus
endereços são exibidos em Configurações. Endpoints de callback e de exclusão
de dados não são publicados nessas páginas.

O build padrão usa `/` e a URL acima. `VITE_BASE_PATH` e `VITE_API_BASE_URL`
podem sobrescrever os valores durante o build. Não coloque chaves em `VITE_*`.
Para o painel interno: `VITE_BASE_PATH=/ig/ VITE_API_BASE_URL=/ig/api yarn build`.

Na API do VPS:

- `PUBLIC_BASE_URL=https://api.phantertools.com/ig` (API, mídia e callbacks OAuth)
- `FRONTEND_BASE_URL=https://phantertools.com` (retorno após login e conexão de contas)
- `CORS_ALLOWED_ORIGINS=https://phantertools.com,https://www.phantertools.com`

Axios usa `withCredentials`. A API permite apenas as origens configuradas e
usa cookies HttpOnly, Secure e SameSite=None quando o frontend está em outra
origem. A API usa um subdomínio de phantertools.com no mesmo VPS para que a sessão
seja do mesmo site e funcione em navegadores que bloqueiam cookies de terceiros.
O MongoDB escuta somente em 127.0.0.1:27017 e não deve ser exposto na rede pública.

As URLs de callback dos provedores continuam na API do VPS, por exemplo
`https://api.phantertools.com/ig/api/auth/google/callback`.
