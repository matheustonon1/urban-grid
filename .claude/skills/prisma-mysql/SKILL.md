---
name: prisma-mysql
description: Como mexer no banco do Urban Grid (Prisma 6 + MySQL 8.4 local em Docker, TiDB Cloud Serverless em produção) — alterar o schema e gerar migration, escrever migration com backfill, modelar unicidade, consultar sem N+1, lidar com relações sem FK e tocar o seed. Use ao editar `prisma/schema.prisma`, criar/rever uma migration, escrever uma query nova ou investigar lentidão e erro de banco (P1001, P2002, P2003, P3009…) — mesmo que o pedido diga só "adicionar um campo" ou "salvar isso no banco".
---

# Banco de dados (Prisma + MySQL/TiDB)

Fonte da verdade: `prisma/schema.prisma` (comentado, leia o model antes de
mexer) e `prisma/migrations/` (versionadas — são o que sincroniza os
desenvolvedores). O cliente é `@/lib/prisma` (singleton em `globalThis` no dev,
para o HMR não abrir uma conexão por recarga).

## Fluxo para mudar o schema

```bash
# 1. edite prisma/schema.prisma
npx prisma migrate dev --name descricao_curta_em_snake_case   # local: gera SQL, aplica, regenera o client
git add prisma/                                               # a migration entra no mesmo commit do código
```

- Produção (TiDB) usa **`npx prisma migrate deploy`**, nunca `migrate dev`. A
  string de conexão de produção vive em `.env.tidb` (gitignored) — **não abra,
  não imprima, não commite**; passe-a só na variável `DATABASE_URL` do comando.
- Depois de `git pull` com migration nova: `npx prisma migrate dev` + `npm install`.
- Comentou/renomeou só um comentário do schema? Não gera migration.
- As migrations `teste_conexao` e `remove_teste` são históricas e já foram
  aplicadas em bancos reais: **nunca apague nem reescreva migration antiga**, o
  `migrate deploy` perderia o histórico.
- Backup/dump do banco nunca é versionado.

## Escrevendo migration à mão (backfill, índice)

O Prisma gera DDL, mas dado existente precisa de SQL seu. Modelo no repositório:
`20260928001500_assinatura_categoria_chave_unicidade`. Lições dela:

- Crie a migration com `--create-only`, edite, e só então aplique.
- **MySQL recusa derrubar um índice que uma FK está usando** → solte as FKs,
  mexa nos índices, recrie as FKs (e comente por quê no SQL).
- Coluna nova `NOT NULL` precisa de `DEFAULT` ou de backfill antes do `NOT NULL`.
- **Mudar um `enum`** é `ALTER TABLE ... MODIFY` no MySQL: acrescentar valor é
  seguro; remover/renomear exige migrar os dados antes.

## Modelagem — decisões já tomadas

- **Unicidade com coluna opcional:** MySQL trata `NULL` como distinto em índice
  único. `AssinaturaCidade` usa `categoriaChave` (sempre não-nula, `"__todas__"`
  quando não há categoria). Quem escreve mantém a coluna em sincronia — só a
  action `criarAssinatura` faz isso; não há trigger.
- **Relação polimórfica sem FK:** `LogModeracao.alvoId`/`Denuncia` apontam para
  Reclamação *ou* Comentário conforme `alvoTipo`. O `onDelete: Cascade` do Prisma
  **não alcança** essas tabelas → apague os logs explicitamente
  (`apagarLogsDeModeracao` em `e2e/helpers.ts` mostra a ordem certa).
- **FK de autoria sem cascade** (`Reclamacao.autor`, `Comentario.autor`,
  `Denuncia.denunciante`, `RespostaOficial.autor/orgao`…): apagar o `User` ou o
  `Orgao` com filhos falha com `P2003` (relação obrigatória → `Restrict`). Apague
  ou anonimize os filhos primeiro. `User.orgao` é opcional, então o padrão do
  Prisma é `SetNull`.
- **Exclusão de conta é anonimização** (`ativo=false`, `senhaHash=null`, tokens
  apagados em `$transaction`) — não `delete`. Mantém autoria e integridade das
  reclamações públicas.
- Segredos sensíveis: `cpfHash` (só hash, nunca CPF), `totpSecret` cifrado
  (AES-256-GCM). Campo novo com dado pessoal → pergunte-se se precisa ser
  guardado e, se sim, se cabe em hash/cifra.
- Strings curtas fixas usam `@db.VarChar(n)`; texto longo `@db.Text`.
- Índices existentes seguem as telas: `@@index([cidadeId, status])`,
  `@@index([status, publicadaEm])`, `@@index([userId, lida])`. Query nova que
  filtra por coluna sem índice em tabela que cresce (`Reclamacao`, `LogModeracao`,
  `Notificacao`) pede um `@@index` na mesma migration.

## Consultas

- `select` só do que a tela usa; `include` aninhado só quando a tela precisa
  (ver `app/page.tsx` e `components/layout/site-header.tsx`).
- Consultas independentes → `Promise.all`. Dentro de `.map` com `await`, desconfie
  de N+1 (use `groupBy`/`findMany ... in` + montagem em memória, como o ranking
  de órgãos da home).
- Contagem para paginação: `lib/util/paginacao` (`calcularSkip`,
  `calcularTotalPaginas`, `lerPaginaAtual`); nunca carregue a lista inteira.
- Status visíveis ao público: sempre `STATUS_PUBLICOS`
  (`lib/reclamacoes/statusPublicos`) — nunca liste status à mão numa página
  pública, senão vaza rascunho/moderação.
- Escrita concorrente: guarda no `WHERE` + `updateMany` (ver skill
  `server-actions`); erro `P2002` = violação de unicidade, trate como "já existe".

## Seed

`prisma/seed.ts` é **idempotente** (`upsert`/`skipDuplicates`) e baixa estados e
municípios do IBGE. Mantenha assim: tem que poder rodar de novo sem duplicar.
`npx prisma db seed`.

## Erros comuns

| Código | Causa provável |
|---|---|
| `P1001` | container parado → `docker compose up -d`, aguarde ~20 s |
| `P2002` | unicidade violada (e-mail, CPF, `categoriaChave`…) |
| `P2003` | FK impedindo apagar/inserir (ver "FK sem cascade") |
| `P3009`/`P3006` | migration falhou ou banco divergente → resolva, não force `--accept-data-loss` |
| client desatualizado | `npx prisma generate` |

Recomeçar do zero (apaga tudo): `docker compose down -v && docker compose up -d
&& npx prisma migrate dev && npx prisma db seed`. Só no banco local.
