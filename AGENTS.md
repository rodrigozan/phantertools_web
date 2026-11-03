# Publicação do Phantertools web

Instrução persistente do proprietário, reiterada em 03/11/2026:

- A Hostinger publica este site automaticamente por Git. Faça commit e `git push origin main` ou `git push origin master`, conforme o ramo principal. O ramo atual é `master`.
- Não use o conector/MCP Hostinger para publicar nem para acompanhar a publicação. Use o fluxo de Git já configurado.
- Valide o build antes do push e confirme depois que o endereço público serve a versão nova.
- A API fica em `../phantertools_api`; quando houver alterações nela, aplique seu build e reinicie o serviço systemd `ig-automatic-tools`, verificando o health endpoint.
- Preserve alterações e credenciais existentes. Commit local, sozinho, não atualiza o site.
