---
name: email-transacional
description: Como criar, alterar e testar e-mails do Urban Grid (verificação, redefinição de senha, convite de órgão, alertas de segurança, notificações, resumo semanal) — a arquitetura de `src/lib/email/`, o layout HTML de tabelas com modo escuro e versão em texto, regras de e-mail que o web não tem (sem CSS moderno, Outlook, prévia), segurança (escape, link, assunto) e como pré-visualizar. Use ao adicionar ou mudar qualquer e-mail, mexer em `messages/*.json` namespace `Email`, ou ao revisar entregabilidade/aparência de e-mail — mesmo que o pedido diga só "manda um aviso por e-mail".
---

# E-mail transacional

E-mail é HTML de 2005 com um coração de 2026: cliente de e-mail ignora CSS moderno,
`<style>` pode ser cortado, o Outlook (Windows) renderiza com o motor do Word e o
modo escuro é imposto pelo cliente. O módulo `src/lib/email/` esconde isso; você
descreve **blocos**, ele monta a moldura.

## Arquitetura (`src/lib/email/`)

| Arquivo | Responsabilidade |
|---|---|
| `index.ts` | única porta de entrada: o app importa só de `@/lib/email` |
| `layout.ts` | `montarEmail({ …, blocos, botao })` → `{ html, text }`: cabeçalho com a marca, cartão, rodapé, modo escuro, botão, link alternativo |
| `templates.ts` | `montarEmail<Tipo>()`: conteúdo de cada e-mail → `{ assunto, html, text, headers? }`, **sem enviar** |
| `envios.ts` | `enviarEmail<Tipo>()`: monta + entrega; falha do provedor nunca lança |
| `transporte.ts` | Resend (ou log, sem `RESEND_API_KEY`) e `ResultadoEnvio` (`enviado`/`simulado`/`falhou`) |
| `tokens.ts` | tokens de verificação, redefinição, troca de e-mail (prefixos no `identifier`) |
| `html.ts` | `esc()`, `htmlParaTexto()`, `assuntoSeguro()` |
| `tradutor.ts` | namespace `Email` no idioma **do destinatário** (`User.idioma`), via `use-intl` |
| `previa.ts` | `npm run email:previa` → `.email-previa/*.html` e `*.txt`, nos dois idiomas |

Blocos disponíveis: `paragrafo` (HTML já escapado), `destaque` (caixa com rótulo —
motivo de rejeição, aviso), `dados` (linhas rótulo → valor), `numero` (número grande
com legenda). `tom: "alerta"` troca o filete amarelo por vermelho e o botão por vermelho
(segurança). Botão e link por extenso saem sozinhos quando há `botao`.

## Adicionar um e-mail novo

1. **Texto**: em `messages/pt-BR.json` **e** `en.json`, namespace `Email.<tipo>`:
   `assunto`, `titulo`, `preheader` (≤ ~90 caracteres, resume a ação), `corpo`,
   `botao`, `rodape` (por que recebeu / o que fazer se não reconhece). Vocabulário e
   tom: skill `ux-writing`. O teste `src/i18n/mensagens.test.ts` cobra paridade.
2. **Construtor** em `templates.ts`: `montarEmail<Tipo>({ …dados, locale })` chamando
   `compor(t, locale, { categoria, titulo, blocos, botao, rodape })`.
3. **Envio** em `envios.ts` (`enviarEmail<Tipo>`) e export em `index.ts`.
4. **Prévia**: inclua o caso em `previa.ts` com dados de exemplo (ponha um caractere
   que exija escape: `<`, `&`, `'`) e rode `npm run email:previa`.
5. **Olhe**: renderize em 600 px e 375 px, claro e escuro (skill `verificacao-visual`,
   seção "E-mails").
6. **Teste** em `index.test.ts`/`layout.test.ts` (conteúdo e escape), sem provedor.

## Regras de construção (por que o HTML é assim)

- **Tabelas + estilo inline.** Nada de flex/grid, `position`, variável CSS ou fonte web.
  Fonte: pilha de sistema (`-apple-system, Segoe UI, Helvetica, Arial`) + mono do
  sistema. O `<style>` só guarda o que o inline não alcança (modo escuro, celular).
- **Sem imagem.** A marca é feita de células de tabela; assim não depende de hospedar
  arquivo, de `localhost` em dev nem de o cliente carregar imagens (muitos bloqueiam).
- **Largura 600 px** com `max-width` e `width:100%`; padding menor em ≤ 620 px.
- **Modo escuro**: `<meta name="color-scheme">` + `@media (prefers-color-scheme: dark)`
  com classes `em-*` e `!important`. Cada elemento colorido leva a classe do papel
  (`em-tinta`, `em-mudo`, `em-botao`…). Cores em hex iguais às de `globals.css`.
- **Botão à prova de Outlook**: `<a>` comum para os clientes modernos e `<v:roundrect>`
  (VML) em comentário condicional `[if mso]` para o Outlook; mais o **link por extenso**
  abaixo (acessibilidade, copiar/colar, filtros que reescrevem botão).
- **Pré-cabeçalho** (preheader) oculto + enchimento invisível, para a prévia da caixa de
  entrada mostrar o resumo e não o começo do corpo.
- **Texto puro obrigatório.** Todo e-mail sai com `text` gerado dos mesmos blocos:
  melhora a entrega, atende cliente só-texto e leitor de tela, e é o que vai pro log em
  dev. O assunto e o texto são conferidos nos testes.
- **Acessibilidade**: `lang` no `<html>`, `role="presentation"` nas tabelas de layout,
  contraste ≥ 4,5:1 (texto `mudo` sobre branco ≈ 6:1), título em `<h1>`, link com texto
  descritivo.

## Segurança

- **Todo texto de usuário/banco em HTML passa por `esc()`** (nome de órgão, cidade, motivo,
  título de reclamação, e-mail). `esc()` também protege atributos (`"` vira `&quot;`) —
  a URL do botão passa por ela. Parâmetros de mensagem que levam `<strong>` são montados
  com `negrito(esc(x))`, nunca concatenando o dado cru.
- **Assunto é texto puro**: não escape (senão "D&#39;Oeste" aparece literal), mas
  `assuntoSeguro()` troca CR/LF por espaço (evita injeção de cabeçalho). O transporte
  faz isso sempre.
- **Link com token**: curto-vivo (redefinição e troca de e-mail 1 h; verificação e
  convite 24 h), base de URL em `lib/util/url` (`NEXT_PUBLIC_APP_URL`). Nunca logar o
  link em produção (`transporte.ts` só imprime o texto quando o Resend não está
  configurado, ou, fora de produção, quando o envio falha).
- **Alerta de segurança** (senha alterada, troca de e-mail pedida) sai **mesmo sem
  e-mail verificado** e pro endereço **antigo**.
- **Cabeçalho `List-Unsubscribe`** nos e-mails de assinatura (resumo semanal).

## O que não fazer

- Não use `<img>` externa, `<script>`, `<form>`, vídeo ou `background-image` de CSS.
- Não dependa do modo escuro "automático" do Gmail: ele inverte cores sem pedir —
  as cores do tema escuro daqui são explícitas.
- Não escreva texto do e-mail em português no código: tudo em `messages/` (exceção
  conhecida: título e mensagem das notificações vêm prontos do banco; só a moldura é
  traduzida — ver comentário em `montarEmailNotificacao`).
- Não mude o texto do botão sem checar `e2e/` e `index.test.ts` (o teste procura
  "Verificar e-mail"/"Verify e-mail").
