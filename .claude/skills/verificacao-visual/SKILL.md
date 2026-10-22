---
name: verificacao-visual
description: Como conferir de verdade uma tela do Urban Grid antes de dar por pronta — screenshots reais em claro, escuro e 375px, checagem de rolagem horizontal, rotas logadas por papel, e-mails renderizados, e como evitar falso alarme de animação. Use ao terminar qualquer mudança de interface, ao fazer redesign, ao revisar visualmente uma tela ou quando o usuário disser "ficou bom?", "tá feio", "testa no celular" — mesmo sem citar screenshot.
---

# Verificação visual

Código que compila não prova que a tela está boa. O fluxo é: **olhar a tela de
verdade → corrigir → olhar de novo**, e só então `tsc` + `lint` + testes (skill
`testes`). O filtro de design (`frontend-design`) vem *antes* disto, não no lugar.

## O script

`capturar.cjs` (nesta pasta) usa o Playwright que já está no `node_modules`:

```bash
node .claude/skills/verificacao-visual/capturar.cjs antes "home,/reclamacoes" claro,escuro,mobile
# rotas logadas: entra antes de capturar
CRED="usuario@exemplo.com:Senha123" node .claude/skills/verificacao-visual/capturar.cjs painel "/painel,/painel/conta"
# só um pedaço da tela
SELETOR="header" node .claude/skills/verificacao-visual/capturar.cjs cabecalho home
# contra o build de produção em outra porta
BASE_URL=http://localhost:3001 node .claude/skills/verificacao-visual/capturar.cjs prod home
```

Saída em `.capturas/<rótulo>/<rota>.<modo>.png` (pasta ignorada pelo git). Abra as
imagens (a ferramenta de leitura de arquivo mostra PNG) e **olhe**: não basta o
script dizer "ok" — ele só detecta rolagem horizontal.

- No Git Bash use `home` para a rota `/` (um `/` solto vira caminho do Windows).
- Tire um "antes" **antes** de mexer, com o mesmo rótulo de modos do "depois".

## O que olhar, sempre

1. **Claro e escuro lado a lado.** Contraste e hierarquia equivalentes, não só
   "não quebrou". Cor nova sem par escuro é bug.
2. **375px.** Sem rolagem horizontal (o script avisa), sem texto cortado, alvos de
   toque confortáveis, nada empilhado de forma estranha (título em 6 linhas).
3. **Estados**, não só o caminho feliz: lista vazia, erro de formulário, carregando
   (`loading.tsx`), campo com texto longo, nome de cidade/órgão comprido.
4. **Conteúdo real.** Se o banco está vazio, semeie dados plausíveis (buraco na rua,
   poste apagado) em vez de aceitar uma tela com "0 resultados" como prova.
5. **Os tiques de "feito por IA"** da skill `frontend-design`.

## Rotas logadas

Crie usuários descartáveis com os helpers de `e2e/helpers.ts` (`criarCidadaoTeste`,
`criarAdminTeste`, `criarOrgaoTeste`, prefixo `e2e-teste`) num script temporário em
`.claude/tmp/` (ignorado pelo git; roda com `npx tsx`), capture, e apague com
`limparDadosTeste()`. Nunca use credenciais reais.

## E-mails

`npm run email:previa` grava o HTML de cada e-mail em `.email-previa/` (nos dois
idiomas). O script aceita URL `file://` no lugar da rota, então:

```bash
node .claude/skills/verificacao-visual/capturar.cjs emails "file:///C:/…/.email-previa/redefinicao-senha.pt-BR.html" claro,escuro,mobile
```

Confira em 600 px (desktop) e 375 px, claro e escuro. Regras de construção na skill
`email-transacional`.

## Falso alarme: confirme antes de reportar

- Screenshot logo após `goto` pega animação no meio (`animate-fade-in` leva 0,35 s,
  `Revelar` 0,7 s). O script já força `reducedMotion` e rola a página; se mesmo assim
  algo parecer errado, confirme com `getComputedStyle`.
- Scroll simulado rápido demais não dispara o `IntersectionObserver` do `Revelar`.
- Dev server em Turbopack às vezes serve CSS velho logo depois de mudar
  `globals.css`: recarregue duas vezes antes de concluir que o estilo falhou.
- Erro `Can't resolve '@vercel/turbopack-next/internal/font/google/font'`: apague
  `.next/dev` e reinicie (README, "Problemas comuns").

## Critério de pronto

- [ ] Capturei claro, escuro e 375px das telas que mudei e **olhei** as imagens
- [ ] Zero "ROLAGEM HORIZONTAL" no script
- [ ] Estados vazio/erro/carregando conferidos
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm test` verdes
- [ ] Specs E2E das telas afetadas rodados (`testes`)
