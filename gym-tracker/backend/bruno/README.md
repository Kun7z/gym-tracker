# Gym Tracker API — Coleção Bruno

Coleção nativa do [Bruno](https://www.usebruno.com/) com todos os endpoints da API.

## Como usar

1. Abra o Bruno e clique em **File → Open Collection**.
2. Selecione a pasta `bruno/` deste projeto.
3. No canto superior direito, selecione o ambiente **local**.
4. Faça login (request `POST login`) e copie o `accessToken` da resposta para a variável `accessToken` do ambiente (ícone de ambiente no canto superior direito → edite o valor).
5. Preencha `exerciseId` (pegue um UUID na listagem do catálogo) e `setId` (pegue um UUID da listagem de sets) conforme necessário.

> Os endpoints protegidos usam `{{accessToken}}` no header `Authorization: Bearer`.
> O refresh token é gerenciado via cookie `httpOnly` — não precisa configurar nada.
