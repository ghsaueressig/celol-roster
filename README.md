# CELOL A & B — GitHub Pages

Site estático com escalações, movimentações e páginas de jogador.

## Como hospedar

1. Crie um repositório no GitHub (pode ser público ou privado com Pages).
2. Faça upload de todos os arquivos desta pasta (index.html, css/, js/, data.json, overrides.json).
3. Vá em **Settings → Pages**.
4. Em **Source** escolha a branch `main` e a pasta `/ (root)`.
5. Salve. O site ficará disponível em `https://SEU-USUARIO.github.io/NOME-DO-REPO/`.

## Atualizar dados

- Substitua `data.json` pela versão nova (gerada a partir da planilha da Liga GG).
- Substitua `overrides.json` se quiser atualizar nicks e roles em massa.
- Faça commit e push. O site atualiza em poucos segundos.

## Páginas de jogador

Clique no nickname de qualquer jogador para abrir a página pessoal (`#/player/RiotID`).

## Estrutura

- `index.html` — página principal
- `css/style.css` — estilos
- `js/app.js` — lógica
- `data.json` — times + movimentações
- `overrides.json` — nicks e roles editados
