# Phanter Tools web

Frontend React estático. A Hostinger executa `yarn build` e publica `dist/`.
O arquivo `public/.htaccess` é copiado para `dist/` e faz o fallback das rotas
React para `index.html` na Hostinger, inclusive ao recarregar ou abrir links diretos.

O navegador acessa diretamente a API HTTPS existente no VPS:
`https://phanterai.tailc5aaf7.ts.net:10000/ig/api`.
Não há servidor Node nem proxy de produção no frontend.

As páginas públicas de Termos de Serviço e Política de Privacidade ficam em
`/termos-de-servico` e `/politica-de-privacidade`. Elas não exigem login; seus
endereços são exibidos em Configurações. Endpoints de callback e de exclusão
de dados não são publicados nessas páginas.

O build padrão usa `/` e a URL acima. `VITE_BASE_PATH` e `VITE_API_BASE_URL`
podem sobrescrever os valores durante o build. Não coloque chaves em `VITE_*`.
Para o painel interno: `VITE_BASE_PATH=/ig/ VITE_API_BASE_URL=/ig/api yarn build`.

Na API do VPS:

- `PUBLIC_BASE_URL=https://phanterai.tailc5aaf7.ts.net:10000/ig` (API, mídia e callbacks OAuth)
- `FRONTEND_BASE_URL=https://phantertools.com` (retorno após login e conexão de contas)
- `CORS_ALLOWED_ORIGINS=https://phantertools.com,https://www.phantertools.com`

Axios usa `withCredentials`. A API permite apenas as origens configuradas e
usa cookies HttpOnly, Secure e SameSite=None quando o frontend está em outra
origem. Navegadores que bloqueiam cookies de terceiros podem impedir a sessão
entre phantertools.com e o domínio ts.net; um domínio da API sob phantertools.com
no mesmo VPS resolve essa restrição sem adicionar outro servidor.

As URLs de callback dos provedores continuam na API do VPS, por exemplo
`https://phanterai.tailc5aaf7.ts.net:10000/ig/api/auth/google/callback`.
