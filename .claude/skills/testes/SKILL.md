---
name: testes
description: Como testar o Urban Grid — Vitest para lógica pura (ao lado do código), Playwright E2E contra servidor real e banco compartilhado, helpers de dados de teste, e as armadilhas que já geraram falso negativo (limites por IP em memória, Turnstile, TOTP em janela repetida, hidratação, aninhamento de DOM, links duplicados). Use ao escrever, rodar ou depurar um teste, ao mudar texto/estrutura de uma tela que um spec localiza, ou antes de dar uma mudança por pronta — mesmo que o pedido diga só "garante que não quebrou".
---

# Testes no Urban Grid

## O que vai em cada nível

| Nível | Onde | Para quê |
|---|---|---|
| **Vitest** | `src/**/*.test.ts`, ao lado do módulo | lógica pura: validação, cálculo, formatação, decisão da moderação, montagem de e-mail |
| **Playwright** | `e2e/*.spec.ts` | fluxo completo no navegador, sem mock: cadastro, 2FA, moderação, órgão, corrida |

Regra de bolso: se dá para testar sem navegador e sem banco, é Vitest. Se o
risco é "duas requisições ao mesmo tempo" ou "a tela de verdade deixa fazer",
é E2E — um unitário não pega corrida nem permissão de UI.

Comandos: `npm test` · `npm run test:e2e` · `npx playwright test e2e/x.spec.ts`
· `npx tsc --noEmit` · `npm run lint`. **Os três (tsc, lint, testes) antes de dar
algo por pronto**, mais olhar a tela de verdade (skill `verificacao-visual`).

## Vitest

- `vitest.config.ts` fixa `AUTH_SECRET` de teste (o `hashCpf` precisa) e exclui
  `e2e/**`. Não dependa do `.env`: `vi.stubEnv` o que importa (veja
  `lib/email/index.test.ts`, que fixa `RESEND_API_KEY`).
- Mock de módulo externo com `vi.mock("resend", …)`; prefira injetar a dependência
  a mockar o Prisma (os módulos puros — `moderacao/estatisticas`,
  `util/paginacao` — existem justamente para não precisar de banco).
- Teste o contrato observável (o que o provedor recebeu, o que a função devolve),
  não detalhes internos.

## Playwright

Pré-requisitos (o Playwright não sobe nada): `docker compose up -d` e o app em
`PLAYWRIGHT_BASE_URL` (padrão `http://localhost:3000`).

**Rodar contra build de produção, em outra porta, é a forma mais estável** e não
atrapalha o `npm run dev` aberto (`next build` usa `.next/`, o dev usa `.next/dev/`):

```bash
npx next build && AUTH_TRUST_HOST=true npx next start -p 3001
PLAYWRIGHT_BASE_URL=http://localhost:3001 npx playwright test
```

`AUTH_TRUST_HOST=true` é obrigatório fora do dev (e fora da Vercel): sem ele o
Auth.js responde `UntrustedHost` em toda tentativa de login e **todo spec que
entra na conta falha por timeout** — parece regressão e não é.

- 1 worker, de propósito: todos os specs escrevem no **mesmo banco** (o de
  desenvolvimento). Nada de `fullyParallel`.
- Cada teste cria os próprios dados com o prefixo `PREFIXO_TESTE` (`e2e-teste`) e
  limpa em `afterEach`/`afterAll` com `limparDadosTeste()`. **Não afirme valor
  absoluto** (o banco tem dados reais): compare antes e depois (veja
  `estatisticas-moderacao.spec.ts`).
- Helpers em `e2e/helpers.ts`: `criarCidadaoTeste`, `criarAdminTeste`,
  `criarOrgaoTeste`, `criarReclamacaoTeste` (direto no banco — evita Gemini e Blob),
  `gerarCodigoTotpAtual`, `aguardarHidratacao`, `apagarLogsDeModeracao`.
- Fluxo real de criação de reclamação com imagem **não** é exercitado de ponta a
  ponta (chamaria Gemini/Blob); o spec do formulário só inspeciona a requisição de
  envio e a aborta.
- Corrida: abra vários `Page`/contextos e dispare com `Promise.all`
  (`moderacao-corrida.spec.ts`, `solicitacoes-orgao-corrida.spec.ts` são o modelo).

## Armadilhas que já custaram horas

1. **Limite por IP em memória.** O servidor guarda contadores (ex.: 5 pedidos de
   redefinição de senha por hora). Rodar a suíte várias vezes seguidas faz
   `redefinir-senha` e `seguranca-sessao` falharem **sem ser regressão**. Reinicie o
   servidor (ou use um `next start` novo) para zerar.
2. **Turnstile no `.env`** bloqueia, corretamente, o navegador automatizado: os
   testes de cadastro em `auth.spec.ts` falham. Comente as duas variáveis
   (`NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`) e reinicie/rebuild —
   `NEXT_PUBLIC_*` é embutida **na hora do build**.
3. **TOTP.** O mesmo código na mesma janela de 30 s é rejeitado como replay (correto
   em produção). Dois códigos seguidos no mesmo teste: `segundosNoFuturo: 30`.
4. **Hidratação.** O HTML do servidor já está na tela quando o `goto` volta, mas a
   página ainda não responde: digitar/clicar antes perde evento ou o React
   reescreve o campo. Use `aguardarHidratacao(page, seletor)` antes de interagir com
   formulário controlado.
5. **Aninhamento de DOM.** Vários specs sobem a árvore com `text=…` +
   `.locator("..")` (protocolo dois níveis acima = cartão de moderação; texto do
   comentário = filho direto do cartão). Ao redesenhar uma tela de admin,
   **preserve esse aninhamento** ou ajuste o spec junto.
6. **Modo estrito do `getByRole`.** Link com o mesmo nome em dois lugares da página
   quebra o teste (ex.: "Transparência" no cabeçalho **e** no rodapé). Não duplique
   rótulos de navegação entre cabeçalho, rodapé e corpo.
7. **Texto de tela é contrato.** Mudar uma string em `messages/pt-BR.json` quebra
   quem a localiza. Antes de mudar copy: `grep -rn "texto antigo" e2e`.
8. **Animação.** Screenshot ou `boundingBox` antes de uma transição CSS terminar dá
   falso alarme — confirme com `getComputedStyle` antes de reportar bug.
9. **Banco compartilhado e `limparDadosTeste`.** Órgão criado pela UI nasce com o
   nome digitado ("Secretaria E2E…", "Órgão Corrida…"); o filtro de limpeza depende
   desses nomes. Spec novo que cria órgão por outro nome deixa lixo e, com a lista
   paginada em 20, esconde botões de outros testes.

## Quando um teste falha

1. Releia a mensagem e o screenshot/trace (`test-results/`, `npx playwright show-report`).
2. Reproduza sozinho (`npx playwright test e2e/x.spec.ts`). Passou isolado e falhou
   na suíte → suspeite das armadilhas 1, 2 e 9 antes de mexer no código.
3. Só então trate como regressão — e escreva/ajuste o teste que a pegaria.
