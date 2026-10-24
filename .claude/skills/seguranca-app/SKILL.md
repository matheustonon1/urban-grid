---
name: seguranca-app
description: Modelo de ameaças e checklist de segurança do Urban Grid — LGPD (CPF só em hash, exportação, exclusão), login/2FA/TOTP, limite de tentativas, CSP e cabeçalhos, upload de imagem, e-mail transacional (escape de HTML, phishing), moderação por IA contra prompt injection e IDOR. Use ao tocar em autenticação, dados pessoais, upload, e-mail, moderação por IA, `next.config.ts` ou ao fazer uma revisão de segurança — mesmo que o pedido diga só "revisar" ou "isso é seguro?".
---

# Segurança no Urban Grid

O produto guarda dado pessoal (CPF, e-mail, endereço de reclamação) e publica
texto de terceiros. Cada item abaixo existe porque houve um furo real ou um risco
claro; o porquê vem junto para você saber quando a regra se aplica a um caso novo.

## Dados pessoais (LGPD)

- **CPF nunca em texto**: `lib/seguranca/cpf.ts` guarda só `cpfHash`
  (HMAC-SHA256 com `AUTH_SECRET`). Trocar `AUTH_SECRET` invalida todos os hashes de
  CPF e os segredos TOTP cifrados (a chave do AES-256-GCM também deriva dele) — não
  é um valor para "rotacionar" sem migração.
- **Exportar** (`/painel/conta/exportar`, `lib/conta/exportarDados.ts`) e
  **excluir** (anonimização completa em `$transaction`) são direitos do titular:
  campo novo com dado pessoal entra nos dois.
- Log, `console.log` e mensagem de erro não carregam CPF, senha, token nem corpo
  de e-mail em produção.
- O nome do usuário é imutável de propósito (identificação pública em comentários
  e responsável cadastrado do órgão) — decisão documentada, não lacuna.

## Autenticação, sessão e 2FA

- Credenciais + JWT; o callback `jwt` (`src/auth.ts`) revalida no banco a cada
  leitura: senha trocada depois do token, banimento e conta inativa derrubam a
  sessão.
- **Força bruta**: senha e TOTP têm contadores separados
  (`lib/seguranca/contadorFalhas.ts` é o algoritmo comum). Login por e-mail/CPF
  inexistente gasta o mesmo tempo de um real (`gastarTempoDeComparacao`).
- **TOTP**: segredo cifrado (AES-256-GCM), **sem replay** (o `timeStep` do último
  código aceito é reservado atomicamente) e códigos de backup de uso único.
- Troca de credencial (senha, e-mail, 2FA) pede a senha atual com limite de
  tentativas e **avisa o endereço antigo**.
- Token de verificação de e-mail e de redefinição de senha **não são
  intercambiáveis**: o `identifier` tem prefixo de propósito
  (`lib/email/tokens.ts`). Não reaproveite o mesmo token para duas finalidades.
- Hoje o login **não consome** `callbackUrl` (as páginas só o anexam ao link).
  Se um dia passar a consumir, aceite apenas caminho interno iniciado por `/`
  (e não por `//`) — URL absoluta vinda da query é open redirect.

## Limites de abuso

`lib/seguranca/rateLimitMemoria.ts` conta por processo. Serve para uma instância;
se o deploy escalar para várias funções serverless, o limite deixa de ser global e
precisa de armazenamento compartilhado (Redis/Upstash). Ao adicionar um limite,
escolha escopo e chave que o atacante não consiga trocar de graça (id de usuário
ou IP, não um campo do formulário).

## Cabeçalhos e CSP (`next.config.ts`)

- CSP com `script-src 'self' 'unsafe-inline'` **porque o tema é aplicado por um
  script inline no `<head>`** (evita flash). Um nonce por request seria mais forte
  e exige `proxy.ts` próprio; enquanto não, não adicione novos scripts inline nem
  libere novas origens sem necessidade. Turnstile é a única origem externa de
  script/frame; imagens do Blob entram por `img-src https:`.
- `frame-ancestors 'self'`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`
  fechada. Não afrouxe para "fazer um embed funcionar".

## Upload de imagem

- Valide o **conteúdo** (magic bytes via `lib/imagens/validarImagem.ts`), não o
  `file.type` que o navegador manda; o Content-Type gravado no Blob vem da
  detecção. Limites em `lib/reclamacoes/limitesImagem.ts` (5 arquivos, 5 MB).
- `lib/imagens/imagem.ts` faz phash (duplicatas), lê EXIF e **desfoca rosto e
  placa**; falha de desfoque não pode ser silenciosa.

## E-mail transacional

- Todo texto vindo de usuário que entra em HTML passa por `esc()`
  (`lib/email`) — senão quem controla o título ou o motivo injeta link num e-mail
  que sai do remetente oficial (phishing com aparência legítima). O **assunto** é
  texto puro: não escape, mas remova quebras de linha (header injection).
- Link de ação com token fica curto-vivo (1 h para redefinição/troca de e-mail,
  24 h para verificação/convite) e é de uso único onde a ação é sensível.
- Alerta de segurança (senha alterada, troca de e-mail pedida) sai mesmo sem
  e-mail verificado.

## Moderação por IA

- O texto do usuário vai isolado no prompt por marcadores explícitos e com a
  instrução de **nunca obedecer comandos embutidos**.
- A resposta estruturada do modelo **não é confiável só porque casou com o
  schema**: revalide com zod, confira se todas as imagens foram avaliadas e aplique
  os cortes de `lib/moderacao/pontuacoes.ts` (0,4 revisão / 0,75 reprovação /
  0,5 comentário) — defesa em profundidade, inclusive com valores fora de faixa.
- Falha do pipeline vira registro com `scoreOfensivo null` + `scoreGeral 1` (não
  entra nas taxas); a reclamação vai para revisão humana, nunca é publicada por
  omissão.

## Autorização

- Cada page e cada action tem o próprio guard; `proxy.ts` é só rede extra.
- IDOR: filtre por dono no `where`. Painel de órgão: `orgaoId` da sessão, e só
  categorias que o órgão atende (`lib/orgaos/orgaoCategoria`).
- Banir/reverter, aprovar órgão e decidir moderação exigem o papel certo **na
  action**, mesmo que o botão só apareça para esse papel.

## Checklist de revisão

- [ ] Dado pessoal novo: hash/cifra? entra em exportar e excluir?
- [ ] Texto de usuário em HTML (página ou e-mail)? Escapado?
- [ ] Consulta escopada ao dono? Guard na action?
- [ ] Ação que envia e-mail/gasta cota tem limite?
- [ ] Novo script/origem externa precisa mexer na CSP? Há alternativa sem mexer?
- [ ] Segredo/token/link fora dos logs e fora do repositório (`.env*` ignorado)?
- [ ] Há teste (unitário ou E2E) cobrindo o caminho de ataque?
