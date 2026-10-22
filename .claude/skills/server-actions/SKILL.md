---
name: server-actions
description: Padrões de backend do Urban Grid (Next.js 16 App Router) para Server Actions, route handlers, guards de acesso e fluxos de formulário — como o projeto valida, autoriza, limita abuso, evita corrida e devolve erro traduzido. Use ao criar ou alterar qualquer `actions.ts`, `definitions.ts`, `route.ts`, `proxy.ts` ou página com mutação, e ao revisar um endpoint — mesmo que o pedido não cite "backend" ou "server action".
---

# Server Actions e endpoints no Urban Grid

O projeto passou por várias rodadas de revisão de segurança e corrida; os padrões
abaixo são o resultado delas, não preferência de estilo. Antes de escrever, leia
uma action vizinha (`src/app/(app)/painel/conta/actions.ts` é a mais completa) e,
para qualquer API do Next 16, o guia em `node_modules/next/dist/docs/01-app/`
(`02-guides/server-actions.md`, `data-security.md`, `authentication.md`,
`forms.md`). **O Next aqui é o 16: `middleware.ts` virou `src/proxy.ts`.**

## Anatomia de uma action

Ordem fixa, nessa sequência:

1. **Guard antes de tudo.** `exigirSessao()` (`lib/seguranca/sessao`) ou o guard da
   área (`exigirModerador`, `exigirAdmin`, `exigirOrgao`). Cada page **e cada
   action** chama o seu: Server Functions postam para a URL da página, então um
   layout, ou uma checagem só no GET, não protege a mutação. `src/proxy.ts` é rede
   de segurança extra, nunca o controle principal.
2. **Validação com zod.** O schema vive em `definitions.ts` ao lado (arquivo
   `"use server"` só pode exportar funções assíncronas, então tipos e schemas ficam
   fora) e é uma *fábrica* que recebe o tradutor: `criarXSchema(t)`. Falhou →
   `return { erros: validado.error.flatten().fieldErrors }`. Nunca confie em
   `FormData.get()` sem passar pelo schema.
3. **Autorização por recurso (IDOR).** Toda consulta de dado do usuário filtra por
   `session.user.id` (ou `orgaoId` do papel ORGAO) no próprio `where`. Receber um
   `id` do cliente e buscar só por ele é falha.
4. **Limite de abuso** quando a ação envia e-mail, gasta cota (Gemini, Blob) ou
   testa credencial: `excedeuLimitePorIp(escopo, chave, limite, janelaMs)` de
   `lib/seguranca/rateLimitMemoria`. Fica *depois* das checagens baratas, para só
   contar pedidos que de fato fariam algo. É por processo, em memória (ver a
   limitação no topo do arquivo — com várias instâncias precisa de Redis).
5. **Escrita protegida contra corrida** (próxima seção).
6. **`revalidatePath`** das páginas que mostram o dado.
7. **Retorno de estado** (`{ mensagem }` / `{ erros }`), nunca exceção para erro
   esperado. Texto sempre vindo de `getTranslations` — ver a skill `ux-writing`.
   Botão que muda dados devolve `ResultadoAcao` (ver "Retorno e confirmação").

## Retorno e confirmação (ações de botão)

Toda action de botão — moderar, administrar, responder, denunciar, avaliar — devolve
um `ResultadoAcao` (`lib/acoes/resultado.ts`): `sucesso()`, `falha()`, `atencao()`,
`informacao()`. **Nunca `return;` mudo**: "outra pessoa já decidiu", "esse nome já
existe" e "o e-mail não saiu" são resposta, não silêncio.

- **Tela:** `<FormularioAcao action={acao.bind(null, id)}>` + `<BotaoAcao>`
  (`components/ui/formulario-acao.tsx`). Mostra o retorno como aviso flutuante
  (`AvisosProvider`, no layout raiz — sobrevive ao cartão que some na revalidação),
  desabilita o botão enquanto roda e, com `limparAoSucesso` / `recolherAoSucesso`,
  zera o campo ou fecha o `<details>`. Formulário com `useActionState` próprio
  (login, Minha conta) continua com `{ mensagem, tipo }` + `MensagemForm`.
- **Confirmação:** passe `confirmacao={{ titulo, descricao, detalhes, confirmar,
  tom, soSeMudar, senha }}`. Peça diálogo quando a ação **muda o acesso de alguém,
  notifica terceiros ou não se desfaz sozinha** (banir, reverter banimento, mudar
  papel, desativar órgão, aprovar/rejeitar solicitação, arquivar/remover por
  denúncia). Decisões de fila de alto volume (aprovar/rejeitar reclamação, comentário)
  não pedem: o motivo digitado já é a fricção. `{campo}` no texto vira o rótulo da
  opção marcada; para o ICU deixar passar, passe `{ campo: "{campo}" }` ao `t()`.
- **Senha de quem age** (`senha: true`, ou `{ campo, valor }` para só um valor — banimento
  permanente) quando muda privilégio: o servidor chama
  `exigirConfirmacaoDeSenha(session.user.id, formData)` ANTES de gravar. O diálogo é
  UX; **a checagem de verdade é a do servidor** (mesmo contador de tentativas do login).
  Erro corrigível sem sair do diálogo → `falhaNoDialogo()`.
- Mudança de privilégio avisa a pessoa afetada (`criarNotificacao` com
  `CONTA_SEGURANCA`) e recusa o que não faz sentido (mudar o próprio papel, banir
  administrador ou a si mesmo, encurtar um banimento que já vale mais).
- Retorno que depende de e-mail diz se ele **saiu**: `enviarEmail*` devolve
  `ResultadoEnvio` e a action vira `atencao()` se `falhou`/`simulado`.

## Corrida (TOCTOU) — o erro que mais custou caro

"Ler status → decidir → gravar" em duas queries deixa duas requisições simultâneas
passarem. Padrões aprovados:

- **Guarda no `WHERE` + conferir `count`:**
  `updateMany({ where: { id, status: "AGUARDANDO_REVISAO" }, data })`, e se
  `count === 0` outra requisição já decidiu → devolve o erro "já foi decidido".
- **Reserva atômica** de recurso de uso único (ex.: `reservarTimeStepTotp`,
  códigos de backup do 2FA): o UPDATE condicional decide quem vence; quem perde
  conta como falha.
- **Unicidade no banco**, não só na checagem: `@unique` / `@@unique` no schema e
  tratar `P2002` (`PrismaClientKnownRequestError`) como "já existe".
- **`$transaction`** quando duas escritas precisam valer juntas (ex.: exclusão de
  conta anonimiza e apaga tokens).
- Teste de regressão de corrida usa **múltiplos `Page` + `Promise.all`** no E2E
  (`e2e/moderacao-corrida.spec.ts` é o modelo) — um unitário não pega isso.

## Segredos, enumeração e sessão

- Resposta idêntica exista a conta ou não (`esqueci-senha`), e gaste o mesmo tempo
  (`gastarTempoDeComparacao`) — senão o login vira oráculo de e-mails.
- Sessão é JWT; o callback `jwt` em `src/auth.ts` revalida no banco a cada leitura
  (senha trocada, banimento, conta excluída derrubam o token). Para "encerrar
  sessões em todos os dispositivos" grava-se `senhaAlteradaEm` — por isso essa data
  **não** é exibida como "última troca de senha".
- Nunca logue token, link de redefinição, senha, CPF ou corpo de e-mail em produção
  (`lib/email/transporte.ts` só imprime o corpo quando o Resend não está
  configurado, ou quando o envio falha fora de produção).
- Uma action que muda credencial (senha, e-mail, 2FA) exige a **senha atual**
  (`verificarSenhaAtual`, com bloqueio por tentativas) e avisa o e-mail antigo.

## Route handlers

- Só quando não dá para ser action (download, webhook, cron). Ex.:
  `app/api/cron/resumo-semanal/route.ts` exige `Authorization: Bearer $CRON_SECRET`
  e responde 401 se a env var nem existir (falha fechada).
- `painel/conta/exportar/route.ts` mostra um download autenticado (LGPD).
- Resposta de erro em JSON curto, sem stack nem detalhe interno.

## O que NÃO fazer

- Não criar um guard "genérico" que sirva a todos os papéis: as regras diferem o
  bastante (ver comentário em `lib/seguranca/sessao.ts`).
- Não colocar regra de negócio em componente cliente.
- Não editar nome do usuário "porque falta": é omissão deliberada
  (`painel/conta/definitions.ts`). **Leia o comentário da área antes de apontar
  lacuna.**
- Não tocar em `reclamacoes/nova/actions.ts` sem checar o fallback de moderação
  (WIP do dono do projeto).

## Checklist de revisão de uma action

- [ ] Guard na primeira linha útil? Papel certo?
- [ ] Entrada passa por zod? Mensagens vêm do tradutor?
- [ ] Consulta escopada ao dono (`session.user.id`/`orgaoId`)?
- [ ] Há leitura-depois-escrita sem guarda no `WHERE`?
- [ ] Envia e-mail/gasta cota sem limite por IP/usuário?
- [ ] Erro devolvido sem vazar detalhe interno? Log sem dado pessoal?
- [ ] `revalidatePath` das telas afetadas?
- [ ] Existe E2E que exercita o caminho de verdade (skill `testes`)?
