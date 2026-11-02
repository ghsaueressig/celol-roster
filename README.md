# CELOL A & B

Site estático com as escalações, movimentações e páginas de jogador da **CELOL A** e **CELOL B** (Liga GG).

[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-live-brightgreen)](https://ghsaueressig.github.io/celol-roster/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## Funcionalidades

- Visualização das escalações da CELOL A e CELOL B
- Ordenação fixa: Top → Jungle → Mid → Bot → Support (+ Coach / Manager)
- Free Agents em colunas por role
- Histórico de movimentações no estilo Leaguepedia
- Páginas individuais de jogador (nick, role, time atual e histórico)
- Suporte a nicks e roles personalizados via `overrides.json`

## Como visualizar

O site está hospedado em:

**https://ghsaueressig.github.io/celol-roster/**

## Atualizar os dados

1. Gere um novo `data.json` a partir da planilha da Liga GG (ou substitua o arquivo atual).
2. (Opcional) Atualize o `overrides.json` com nicks e roles corrigidos.
3. Faça commit e push na branch `main`.
4. O GitHub Pages atualiza automaticamente em alguns segundos.

### Estrutura do `overrides.json`

```json
{
  "RiotID#TAG": {
    "nick": "Nickname",
    "role": "Top"
  }
}
```

Roles válidas: `Top`, `Jungle`, `Mid`, `Bot`, `Support`, `Coach`, `Manager`.

## Páginas de jogador

Clique no nickname de qualquer jogador para abrir a página pessoal.

URL direta:

```
https://ghsaueressig.github.io/celol-roster/#/player/RiotID%23TAG
```

## Estrutura do projeto

```
.
├── index.html          # Página principal
├── css/style.css       # Estilos
├── js/app.js           # Lógica do site
├── data.json           # Times + movimentações
├── overrides.json      # Nicks e roles personalizados
└── README.md
```

## Licença

Código sob licença [MIT](LICENSE).  
Os dados de elenco são informações públicas da Liga GG.
