<div align="center">

<img src="docs/banner.svg" alt="Urban Grid: reclamações urbanas com resposta pública e moderação assistida por IA" width="100%">

<br>

<p>
  <a href="https://github.com/matheustonon1/urban-grid/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/matheustonon1/urban-grid/actions/workflows/ci.yml/badge.svg"></a>
  <img alt="Next.js 16" src="https://img.shields.io/badge/Next.js-16-0A52C4?style=flat-square&labelColor=0E1520&logo=nextdotjs&logoColor=white">
  <img alt="React 19" src="https://img.shields.io/badge/React-19-0A52C4?style=flat-square&labelColor=0E1520&logo=react&logoColor=white">
  <img alt="TypeScript 5" src="https://img.shields.io/badge/TypeScript-5-0A52C4?style=flat-square&labelColor=0E1520&logo=typescript&logoColor=white">
  <img alt="Prisma 7" src="https://img.shields.io/badge/Prisma-7-0A52C4?style=flat-square&labelColor=0E1520&logo=prisma&logoColor=white">
  <img alt="MySQL 8.4" src="https://img.shields.io/badge/MySQL-8.4-0A52C4?style=flat-square&labelColor=0E1520&logo=mysql&logoColor=white">
  <img alt="Tailwind CSS 4" src="https://img.shields.io/badge/Tailwind_CSS-4-0A52C4?style=flat-square&labelColor=0E1520&logo=tailwindcss&logoColor=white">
  <img alt="Licença MIT" src="https://img.shields.io/badge/Licen%C3%A7a-MIT-FFC20E?style=flat-square&labelColor=0E1520">
</p>

<p>
  <a href="#sobre-o-projeto">Sobre</a> ·
  <a href="#funcionalidades">Funcionalidades</a> ·
  <a href="#moderação-por-ia">Moderação</a> ·
  <a href="#arquitetura">Arquitetura</a> ·
  <a href="#começando">Começando</a> ·
  <a href="#testes">Testes</a> ·
  <a href="#segurança-e-privacidade">Segurança</a> ·
  <a href="#problemas-comuns">Problemas comuns</a> ·
  <a href="#autoria">Autoria</a>
</p>

<p>
  <sub>Trabalho de Conclusão de Curso · Matheus Tonon dos Reis e Pablo Aragão Amaral Almeida</sub>
</p>

</div>

---

## Sobre o projeto

O **Urban Grid** é uma plataforma web de reclamações urbanas por município. Cidadãos registram problemas do bairro (buracos na via, iluminação pública, coleta de lixo, saneamento, transporte) com texto e imagens; **órgãos públicos** cadastrados respondem oficialmente e atualizam o status; e **quem reclamou avalia** se o problema foi de fato resolvido. Todo conteúdo passa por **moderação assistida por Inteligência Artificial** antes de ser publicado, com revisão humana como rede de segurança.

Trabalho de Conclusão de Curso.

```mermaid
flowchart LR
    A["Cidadão registra<br/>a reclamação"] --> B{"Moderação<br/>IA + revisão humana"}
    B -->|publica| C["Órgão responde<br/>status e prazo"]
    B -->|dúvida| H["Moderador<br/>decide"]
    B -->|rejeita| R["Autor pode<br/>contestar"]
    R --> H
    H --> C
    C --> D{"Autor avalia<br/>a resolução"}
    D -->|resolvida| F(["Resolvida"])
    D -->|não resolvida| C
```

<div align="center">

| 24 | 25 | 324 | 169 |
|:---:|:---:|:---:|:---:|
| tabelas no banco | migrações versionadas | testes unitários (Vitest) | testes de ponta a ponta (Playwright) |

<sub>Números de 04/11/2026.</sub>

</div>

---

## Capturas de tela

<table>
  <tr>
    <td width="50%" valign="top">
      <img src="docs/capturas/home.webp" alt="Página inicial: título «Registre o problema do seu bairro», uma ficha com o protocolo e as etapas de uma reclamação e os números da plataforma" width="100%">
      <br><sub><b>Início.</b> A reclamação mais recente de verdade aparece numa ficha, com protocolo e etapas.</sub>
    </td>
    <td width="50%" valign="top">
      <img src="docs/capturas/reclamacao.webp" alt="Detalhe de uma reclamação com a resposta oficial do órgão, novo status, prazo estimado e linha do tempo" width="100%">
      <br><sub><b>Reclamação.</b> Resposta oficial com novo status e prazo, linha do tempo e confirmações da comunidade.</sub>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <img src="docs/capturas/painel-orgao.webp" alt="Painel do órgão com as filas «Sem resposta» e «Em acompanhamento», busca por protocolo e o cartão de reputação pública" width="100%">
      <br><sub><b>Painel do órgão.</b> Duas filas, busca por protocolo, filtro de categoria e a reputação pública.</sub>
    </td>
    <td width="50%" valign="top">
      <img src="docs/capturas/transparencia.webp" alt="Página de transparência com os indicadores gerais e o ranking público de órgãos" width="100%">
      <br><sub><b>Transparência.</b> Indicadores gerais e ranking de órgãos por resolução, tempo de resposta e nota.</sub>
    </td>
  </tr>
</table>

<sub>Capturas em tema claro, com dados de demonstração (`npm run db:seed:demo`). O site também tem tema escuro e interface em português e inglês.</sub>

---

## Funcionalidades

### Para o cidadão

- **Feed público por cidade**, com filtros por categoria e status e ordenação por recência ou por confirmações da comunidade ("também sofro com isso")
- **Formulário guiado** para registrar a reclamação: etapas numeradas, categorias à vista, endereço pelo CEP, fotos com arrastar e soltar, progresso e dicas ao lado; um erro de validação nunca apaga o que a pessoa já escreveu
- **Acompanhamento por protocolo** e linha do tempo pública de cada reclamação
- **Recurso contra rejeição**: o autor pode contestar uma vez, e a reclamação vai para revisão humana com o motivo original e o argumento do autor lado a lado
- **Avaliação da resolução**: quem reclamou diz se foi resolvido; se não foi, a reclamação reabre e o órgão é avisado
- **Comentários** em cada reclamação, moderados por IA
- **Notificações** no sino e por e-mail nos eventos-chave (reclamação publicada ou rejeitada, resposta oficial, pedido de avaliação, arquivamento por denúncia), só para quem já verificou o e-mail
- **Assinatura de cidade e categoria** com resumo semanal por e-mail
- **Minha conta**: autenticação em duas etapas, códigos de backup, encerrar sessões em todos os dispositivos, baixar os próprios dados, cidade padrão e exclusão da conta
- **Pedido de inclusão de cidade** nova, quando o município ainda não existe na plataforma

### Para o órgão público

- **Cadastro com aprovação**: prefeituras e secretarias solicitam acesso publicamente, informando o **CNPJ** e o **site oficial**; um administrador confere (inclusive consultando o CNPJ na Receita pelo cartão do pedido), aprova ou rejeita, e só então a conta é criada e um link de definição de senha é enviado
- **Segundo fator obrigatório**: a conta de órgão só abre o painel e responde reclamações depois de ativar a autenticação em duas etapas
- **Painel do órgão** com duas filas (**sem resposta** e **em acompanhamento**), busca por protocolo ou título e filtro de categoria
- **Avisos ao órgão**: um aviso no sino, na hora, quando é publicada uma reclamação da cidade e da categoria dele, e um **resumo semanal por e-mail** com a fila sem resposta (quantas, quantas chegaram na semana, quantas já passaram de 15 dias). O mesmo cron do resumo dos assinantes; quem não quer o e-mail desliga em "Minha conta"
- **Resposta oficial** com novo status e prazo estimado, e correção do texto e do prazo por 15 minutos
- **Reputação pública**, nos moldes do Reclame Aqui: selo (Ótimo, Bom, Regular ou Ruim) calculado a partir do índice de resolução, que **conta como não resolvida a reclamação que ficou mais de 15 dias sem nenhuma resposta** (só as publicadas depois de o órgão entrar na plataforma; se outro órgão responde, ela deixa de contar contra os demais). O tempo médio de resposta e a nota dos cidadãos aparecem ao lado, sem entrar no selo
- **Categorias atendidas**: por padrão o órgão atende tudo da cidade; um administrador pode restringir por categoria

### Para moderação e administração

- **Fila de revisão humana** de reclamações e comentários, para corrigir falsos positivos sem depender só da decisão automática
- **Dashboard de estatísticas de moderação**, com período selecionável (7, 30, 90 dias ou tudo) e comparação com o período anterior: decisões da IA, fila por idade, volume ao longo do tempo, distribuição das pontuações, critérios que mais disparam revisão, quanto os moderadores discordam da IA, denúncias, versões do prompt e consumo do modelo. Cada gráfico tem versão em tabela
- **Denúncias**, banimento (e reversão), mudança de papel, desativação de órgão e aprovação de pedidos de órgão e de cidade
- **Registro de auditoria** das ações de administração
- **Reautenticação** com senha e código de duas etapas nas ações que mudam privilégio

### Na plataforma

- **Tema claro e escuro** e interface em **português e inglês**, com e-mails e notificações no idioma de quem recebe
- **Acessibilidade** WCAG 2.2 AA, verificada por varredura automática (axe-core) nas telas principais
- **Datas no fuso de Brasília**; o prazo de uma resposta é um dia de calendário
- **LGPD**: consentimento no cadastro, CPF só em hash, exportação dos dados e exclusão da conta por anonimização

---

## Moderação por IA

O diferencial técnico é o **pipeline de moderação automatizada**: todo conteúdo submetido passa por uma sequência de verificações antes de ser publicado, combinando checagens determinísticas com análise por modelo de linguagem multimodal.

| Camada | Verificação |
|---|---|
| Pré-checagens | Limite de envios por usuário, tipo e tamanho do arquivo, hash perceptual da imagem (detecção de repostagem), metadados EXIF (data e geolocalização da foto) |
| Análise de texto | Conteúdo ofensivo ou discurso de ódio, spam, exposição de dados pessoais de terceiros, conteúdo fora do escopo municipal, indícios de desinformação |
| Análise de imagem | Conteúdo impróprio, presença de rostos ou placas legíveis, e coerência entre o que a imagem mostra e o que o texto descreve |
| Decisão | Publicação automática, encaminhamento para revisão humana ou rejeição com justificativa e direito a recurso |

Todas as decisões são registradas com o retorno do modelo, a versão do prompt utilizada e a latência, permitindo auditoria e análise posterior de precisão.

> [!IMPORTANT]
> **Nota metodológica sobre desinformação.** O sistema **não verifica fatos**. Nenhum modelo de linguagem consegue confirmar se existe de fato um buraco em determinada rua. O que o pipeline detecta são **indícios** de conteúdo não confiável: incoerência entre imagem e texto, metadados inconsistentes, imagem reciclada de outra ocorrência, linguagem sensacionalista, alegações amplas não verificáveis.
>
> A validação factual é delegada a um mecanismo de **corroboração comunitária**: confirmações independentes de outros usuários verificados do mesmo município elevam o grau de confiabilidade da denúncia.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Front-end | React 19 via Next.js 16 (App Router, Turbopack), TypeScript |
| Estilização | Tailwind CSS v4 com design system próprio (tokens semânticos claro/escuro em `globals.css`, sem biblioteca de componentes); fontes Archivo, IBM Plex Sans e IBM Plex Mono |
| Back-end | Next.js Route Handlers e Server Actions |
| Banco de dados | MySQL 8.4 (TiDB Cloud em produção) |
| ORM | Prisma 7 (client gerado em `src/generated/prisma`, driver adapter do MariaDB/MySQL) |
| Autenticação | Auth.js (NextAuth), login por e-mail ou CPF |
| Validação | Zod |
| Internacionalização | next-intl (pt-BR e en) |
| Moderação | API de LLM multimodal (Gemini) |
| Armazenamento de imagem | Vercel Blob |
| Processamento de imagem | sharp (redimensionamento/desfoque), blockhash-core (hash perceptual), exifr (metadados EXIF) |
| Autenticação em duas etapas | otplib (TOTP) + qrcode (QR code de configuração) |
| Envio de e-mail | Resend (opcional: sem chave configurada, o texto do e-mail, com o link, fica no log do servidor). Layout próprio de e-mail (HTML de tabelas, modo escuro, versão em texto) em `src/lib/email/` |
| Antifake no cadastro | Cloudflare Turnstile (opcional) |
| Testes | Vitest (unitários) + Playwright (end-to-end) + axe-core (varredura de acessibilidade) |
| Infraestrutura local | Docker Compose |

As versões do Prisma estão fixadas propositalmente. A CLI passou por reestruturação em versões posteriores, com mudança de comandos e de formato de configuração. Fixar a versão garante reprodutibilidade do ambiente ao longo do desenvolvimento e na avaliação do trabalho.

---

## Arquitetura

```mermaid
flowchart TB
    NAV["Navegador<br/>React 19 · Tailwind v4"]
    subgraph NEXT["Next.js 16 · App Router"]
        PROXY["proxy.ts<br/>barra por papel"]
        SRV["Server Components · Server Actions<br/>Route Handlers"]
    end
    DB[("MySQL 8.4<br/>TiDB Cloud em produção")]
    NAV --> PROXY --> SRV
    SRV -->|Prisma| DB
    SRV --> GEM["Gemini<br/>moderação multimodal"]
    SRV --> BLOB["Vercel Blob<br/>imagens"]
    SRV --> MAIL["Resend<br/>e-mail"]
    NAV -.->|widget| TURN["Cloudflare Turnstile<br/>antifake no cadastro"]
    SRV -.->|valida| TURN
    CRON["Vercel Cron<br/>resumo semanal"] --> SRV
```

Decisões que moldam o código:

- **A regra vive no servidor.** Cada página e cada Server Action chamam o próprio guard por papel; o `src/proxy.ts` é uma camada extra, não o controle principal.
- **Escrita concorrente protegida.** Onde duas requisições poderiam decidir a mesma coisa (moderação, resposta de órgão, códigos de backup), a guarda vai no `WHERE` de um `updateMany` ou dentro de uma `$transaction`, e há testes E2E com sessões simultâneas.
- **Limites de abuso em dois níveis.** O que manda e-mail ou mexe em credencial usa um contador no banco (`LimiteAbuso`), válido entre instâncias serverless; leituras chamadas a cada tecla (CEP, busca de cidade) usam contador em memória.
- **Texto de tela é dado.** Toda string visível vive em `messages/pt-BR.json` e `messages/en.json`, com um teste que exige as mesmas chaves e os mesmos parâmetros nos dois idiomas.
- **Identidade por tokens.** Cores são tokens semânticos com par claro e escuro, então componentes não carregam `dark:`.

---

## Começando

### Pré-requisitos

- **Node.js** 22.12 ou superior (o CI usa a 24; o Vitest 5 exige 22.12+) — [nodejs.org](https://nodejs.org)
- **Docker Desktop** — [docker.com](https://www.docker.com/products/docker-desktop)
- **Git** — [git-scm.com](https://git-scm.com)

Não é necessário instalar MySQL na máquina. O banco roda em container.

```bash
node --version
docker --version
git --version
```

### Resumo

```bash
git clone https://github.com/matheustonon1/urban-grid.git
cd urban-grid
npm install
cp .env.example .env          # Windows: copy .env.example .env
# edite o .env: DATABASE_URL, AUTH_SECRET, GEMINI_API_KEY, BLOB_READ_WRITE_TOKEN
docker compose up -d
npx prisma migrate dev
npx prisma db seed
npm run dev                   # http://localhost:3000
```

Cada passo, com os detalhes:

### 1. Clonar o repositório

```bash
git clone https://github.com/matheustonon1/urban-grid.git
cd urban-grid
```

### 2. Instalar as dependências

```bash
npm install
```

### 3. Configurar as variáveis de ambiente

Copie o arquivo de exemplo:

```bash
# Windows
copy .env.example .env

# Linux / macOS
cp .env.example .env
```

Abra o `.env` e preencha ao menos as quatro primeiras:

```env
DATABASE_URL="mysql://root:root@localhost:3306/reclame_cidade"
AUTH_SECRET="cole-aqui-uma-chave-gerada"
GEMINI_API_KEY="sua-chave-da-api"
BLOB_READ_WRITE_TOKEN="seu-token-do-vercel-blob"
```

Para gerar o `AUTH_SECRET`:

```bash
npx auth secret
```

| Variável | Quando | Para quê |
|---|---|---|
| `DATABASE_URL` | obrigatória | Conexão com o MySQL. O exemplo acima aponta para o container do `docker compose`. É lida por `prisma.config.ts` (CLI) e por `src/lib/bancoDeDados.ts` (aplicação). Para um banco com TLS (TiDB Cloud), acrescente `?sslaccept=strict`; `connection_limit` (padrão 5) e `connect_timeout` (segundos, padrão 10) também valem. |
| `AUTH_SECRET` | obrigatória | Assina a sessão. Dele também derivam o hash do CPF e a chave que cifra o segredo do 2FA: **trocá-lo invalida os CPFs e os segredos de 2FA já gravados**. |
| `GEMINI_API_KEY` | obrigatória | Moderação por IA de reclamações e comentários. |
| `BLOB_READ_WRITE_TOKEN` | para enviar fotos | Upload de imagem das reclamações. Crie um Blob store gratuito em [vercel.com](https://vercel.com) → Storage → Create → Blob e copie o token; funciona em desenvolvimento local, não é preciso publicar o projeto na Vercel. Sem ele, o restante do app funciona; só o envio de fotos falha. |
| `NEXT_PUBLIC_APP_URL` | opcional | Monta o link do e-mail de verificação e as URLs absolutas de `robots.txt` e `sitemap.xml`. Padrão: `http://localhost:3000`. **Em produção, configure com o domínio real**, senão o sitemap aponta para o localhost. |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | opcionais | Envio real de e-mail via [Resend](https://resend.com) (plano grátis: 3.000 e-mails/mês). Sem `RESEND_API_KEY`, o link só aparece no log do servidor, o que basta para desenvolver. Sem domínio próprio verificado, `RESEND_FROM_EMAIL` pode ficar em branco (usa `onboarding@resend.dev`), mas aí só entrega ao e-mail cadastrado na sua conta Resend. |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | opcionais | Antifake no cadastro. Crie uma chave grátis em [dash.cloudflare.com](https://dash.cloudflare.com) → Turnstile → Add site. Sem elas, o cadastro funciona, só sem verificação de bot. |
| `CRON_SECRET` | para o resumo semanal | Protege `/api/cron/resumo-semanal`: só quem manda `Authorization: Bearer <valor>` dispara o envio. Gere um valor aleatório e configure o mesmo na Vercel, que manda o header nos crons de `vercel.json`. |
| `AUTH_TRUST_HOST` | só fora do dev | `true` ao rodar `next start` fora da Vercel (ver [Testes](#testes)). |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_SENHA`, `SEED_ORGAO_EMAIL`, `SEED_ORGAO_SENHA` | opcionais | Contas criadas pelo seed. Há valores padrão só para desenvolvimento. |
| `SEED_IBGE` | opcional | `local` faz o seed ler a geografia de `prisma/dados/ibge-localidades.json` em vez da API do IBGE. |

> [!WARNING]
> O arquivo `.env` está no `.gitignore` e **nunca deve ser versionado**.

### 4. Subir o banco de dados

Com o Docker Desktop aberto:

```bash
docker compose up -d
```

A primeira execução baixa a imagem do MySQL (aproximadamente 500 MB). Verifique se o container subiu:

```bash
docker compose ps
```

O container `reclame_mysql` deve aparecer com status `Up`. Aguarde cerca de 20 segundos após a primeira subida: o MySQL leva um tempo para concluir a inicialização interna.

### 5. Aplicar as migrations

```bash
npx prisma migrate dev
```

Isso cria todas as tabelas do sistema no banco. (Em produção, o comando é `npx prisma migrate deploy`.)

### 6. Popular os dados iniciais

```bash
npx prisma db seed
```

Carrega os municípios (da API do IBGE; se ela estiver fora do ar, o seed usa o arquivo `prisma/dados/ibge-localidades.json`), as categorias de reclamação, uma conta de administrador e um órgão de demonstração. O seed é idempotente: pode rodar de novo sem duplicar.

> [!TIP]
> Defina `SEED_ADMIN_EMAIL` e `SEED_ADMIN_SENHA` antes de rodar o seed em qualquer banco que não seja o seu local. Os valores padrão existem só para desenvolvimento. Contas de administrador precisam ativar a autenticação em duas etapas em "Minha conta" para usar as ações protegidas (mudar papel, banir de forma permanente, aprovar órgão).

### 7. Iniciar a aplicação

```bash
npm run dev
```

Acesse **http://localhost:3000**

Para ver o site com movimento, `npm run db:seed:demo` cria reclamações pendentes, em andamento e resolvidas (com e sem avaliação) para o órgão de demonstração. Entre com `demo.orgao@urbangrid.local` / `demo1234` e abra o painel do órgão. `npm run db:seed:demo -- --limpar` remove tudo que ele criou.

---

## Comandos de uso frequente

### Aplicação

| Comando | O que faz |
|---|---|
| `npm run dev` | Ambiente de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run start` | Executa o build |
| `npm run lint` | Verificação de código |
| `npm test` | Testes unitários (Vitest) |
| `npm run test:e2e` | Testes end-to-end (Playwright), ver [Testes](#testes) |
| `npm run email:previa` | Gera o HTML de todos os e-mails em `.email-previa/` (abra no navegador) |
| `npm run db:seed:demo` | Reclamações de demonstração para ver o site como órgão (`-- --limpar` remove) |
| `node scripts/auditar-dependencias.mjs` | Auditoria de dependências de produção, a mesma do CI |

### Banco de dados

```bash
docker compose up -d       # liga o banco
docker compose stop        # desliga preservando os dados
docker compose ps          # verifica o status
docker compose logs -f db  # acompanha os logs
```

### Prisma

```bash
npx prisma studio                    # interface visual do banco (localhost:5555)
npx prisma migrate dev --name nome   # cria e aplica uma migration
npx prisma generate                  # regenera o client (src/generated/prisma) após alterar o schema
```

### Recomeçar o banco do zero

Útil quando o banco local fica inconsistente. Apaga **todos** os dados:

```bash
docker compose down -v
docker compose up -d
npx prisma migrate dev
npx prisma db seed
```

### Integração contínua

O GitHub Actions (`.github/workflows/ci.yml`) roda a cada push na `main` e a cada PR dois jobs em paralelo:

- **verificar**: tipos (`tsc`), lint, testes unitários e o **gate de auditoria** `scripts/auditar-dependencias.mjs`, que barra o PR se houver vulnerabilidade alta ou crítica em dependência de produção sem exceção registrada (a exceção é um ID de advisory, com motivo e data de revisão).
- **e2e**: a suíte Playwright inteira contra um build de produção e um MySQL 8.4 descartável. Aplica todas as migrations num banco vazio, roda o seed (com a geografia lida de `prisma/dados/ibge-localidades.json`, porque a API do IBGE dá timeout nos runners do GitHub), faz o build e executa os testes, sem chaves de Gemini, Resend, Blob ou Turnstile, de propósito (os specs criam as reclamações direto no banco e o e-mail vira log).

Se um teste falhar, o relatório HTML com screenshots e traces e o log do servidor ficam como artefato do job por 7 dias.

---

## Testes

| Nível | Onde | Para quê |
|---|---|---|
| **Vitest** | `src/**/*.test.ts`, ao lado do módulo | Lógica pura: validação, cálculo, formatação, decisão da moderação, montagem de e-mail |
| **Playwright** | `e2e/*.spec.ts` | Fluxos completos no navegador contra um servidor real, sem mocks |
| **axe-core** | `e2e/acessibilidade.spec.ts` | Varredura nas telas principais, em claro e escuro; falha em violação grave (contraste, campo sem rótulo, landmark duplicado) |

Os testes em `e2e/` cobrem cadastro e login, bloqueio por força bruta, ciclo completo do 2FA, órgão restrito por categoria, recurso contra rejeição, onboarding de órgão de ponta a ponta, denúncia e banimento, avaliação de resolução, exclusão de conta, confirmação ("também sofro com isso"), formulário de nova reclamação, estatísticas de moderação e **corridas** (duas sessões decidindo a mesma coisa ao mesmo tempo). Cada teste cria os próprios dados (usuários com e-mail prefixado `e2e-teste-*`, reclamações com protocolo prefixado) e limpa tudo ao final, então é seguro rodar contra o banco de desenvolvimento normal.

### Rodando

O Playwright não sobe nada sozinho. Pré-requisitos:

```bash
docker compose up -d   # banco de dados
npm run dev            # servidor em http://localhost:3000
```

Depois, em outro terminal:

```bash
npm run test:e2e                        # roda toda a suíte
npx playwright test e2e/totp.spec.ts    # roda só um arquivo
npx playwright show-report              # abre o relatório da última execução
```

Também é possível rodar a suíte contra um **build de produção em outra porta**, sem mexer no `npm run dev` aberto (mais estável, e zera os limites por IP em memória):

```bash
npx next build
AUTH_TRUST_HOST=true npx next start -p 3001    # AUTH_TRUST_HOST é obrigatório fora do dev
PLAYWRIGHT_BASE_URL=http://localhost:3001 npx playwright test
```

> [!CAUTION]
> Se `NEXT_PUBLIC_TURNSTILE_SITE_KEY` e `TURNSTILE_SECRET_KEY` estiverem configuradas no `.env`, os testes de cadastro em `auth.spec.ts` falham: a Cloudflare bloqueia, corretamente, o navegador automatizado (é o antifake funcionando). Para rodar a suíte completa, comente essas duas variáveis, reinicie o servidor (`NEXT_PUBLIC_*` entra no build, então num build de produção é preciso refazê-lo) e descomente depois para voltar a testar o widget manualmente.

<details>
<summary><b>Detalhes e armadilhas</b></summary>

<br>

- **Um worker, de propósito** (`playwright.config.ts`): os testes escrevem no mesmo banco compartilhado, então paralelismo entre arquivos causaria corrida (ex.: dois testes usando a fila de `/moderacao` ao mesmo tempo).
- **Sem upload real.** Nenhum teste passa pelo fluxo real de criação de reclamação com imagem (usam `criarReclamacaoTeste()`, direto no banco): isso evitaria chamar a API do Gemini e o Vercel Blob de verdade a cada execução. Os testes do formulário só inspecionam a requisição de envio (as fotos vão nela) e a abortam antes de chegar ao servidor.
- **Banco compartilhado.** O banco de testes é o mesmo do desenvolvimento, que já tem análises de moderação de verdade: os testes de estatísticas comparam o número antes e depois de semear dados, nunca um valor absoluto.
- **Limites por IP.** Os limites que mandam e-mail (ex.: 5 pedidos de redefinição de senha por hora) ficam no banco (`LimiteAbuso`) e não zeram ao reiniciar o servidor; a suíte apaga esses contadores ao final. Se rodar um spec isolado várias vezes e `redefinir-senha` ou `seguranca-sessao` falharem sem ser regressão, limpe a tabela (`DELETE FROM LimiteAbuso`). Os limites em memória (CEP e busca de cidade) zeram ao reiniciar o servidor.
- **Trocar de conta no mesmo navegador** dentro de um teste: use `sairDaSessao(page)` (`e2e/helpers.ts`), nunca `clearCookies()` solto. Num build de produção, o prefetch dos links reemite o cookie depois da limpeza.

</details>

---

## Estrutura de pastas

<details open>
<summary><b>Árvore do projeto</b></summary>

```
urban-grid/
├── prisma/
│   ├── schema.prisma        # modelo de dados
│   ├── migrations/          # histórico versionado do banco
│   ├── dados/               # geografia do IBGE em arquivo (usada pelo seed no CI)
│   ├── seed.ts              # dados iniciais (geografia, categorias, admin e órgão de demonstração)
│   └── seed-demo-orgao.ts   # reclamações de demonstração para ver o painel do órgão
├── src/
│   ├── auth.ts              # configuração do Auth.js (login, sessão, revalidação no banco)
│   ├── proxy.ts             # barra rotas por papel antes da página (defesa em profundidade)
│   ├── app/
│   │   ├── (auth)/          # login (com 2FA), cadastro, verificação de e-mail e redefinição de senha
│   │   ├── (app)/           # área autenticada (painel, conta + 2FA, assinaturas, reclamações, órgão)
│   │   ├── (admin)/         # moderação humana, estatísticas, denúncias, usuários, banimentos, auditoria, órgãos e cidades
│   │   ├── cidades/         # feed público por cidade e pedido de inclusão de cidade
│   │   ├── orgaos/          # perfil público de reputação por órgão
│   │   ├── orgao/           # solicitação pública de acesso e definição de senha
│   │   ├── reclamacoes/     # feed público global (busca por cidade/palavra-chave)
│   │   ├── transparencia/   # dados públicos e ranking de órgãos
│   │   ├── termos/          # Termos de Uso e Política de Privacidade
│   │   └── api/             # rotas de API (auth, busca de cidade, consulta de CEP, cron do resumo semanal)
│   ├── components/
│   │   ├── ui/              # blocos base: marca, cabeçalho de página, seção com régua, resumo lateral, aviso (em linha e flutuante), formulário de ação com diálogo de confirmação, etiqueta de estado, estado vazio, esqueleto, moldura das telas de entrada
│   │   ├── layout/          # cabeçalho fixo, rodapé, menu do usuário, sino, tema, idioma, abas do admin
│   │   ├── formulario/      # campo com rótulo e erro, combobox de cidade, termos, troca de tipo de cadastro
│   │   ├── reclamacao/      # cartão de reclamação, badge de status, categorias, denúncia
│   │   └── moderacao/       # decisões, pontuações da IA, tempo na fila
│   ├── hooks/               # hooks compartilhados (fechar menu ao clicar fora / Esc)
│   ├── i18n/                # idiomas (pt-BR/en), cookie e mensagens; teste de paridade das chaves
│   ├── lib/
│   │   ├── prisma.ts        # instância única do Prisma Client
│   │   ├── estilos.ts       # classes compartilhadas (botões, campos, cartões, estrutura de página em grade de 12 colunas)
│   │   ├── metadata.ts      # título de aba por página
│   │   ├── seguranca/       # CPF (hash), TOTP + códigos de backup, limites de tentativas e de abuso, Turnstile, destino pós-login, guard de sessão
│   │   ├── acoes/           # retorno padrão das Server Actions (`ResultadoAcao`) e reautenticação (senha + 2FA) em ações que mudam acesso
│   │   ├── auditoria/       # registro de quem mudou acesso ou decidiu em nome da plataforma
│   │   ├── conta/           # identificador (e-mail/CPF), verificação de e-mail, senha atual, exportação de dados (LGPD)
│   │   ├── email/           # tokens, templates, layout HTML, envio (Resend) e prévia; ver o index.ts
│   │   ├── notificacoes/    # notificações in-app + e-mail, aviso em tempo real e resumo semanal ao órgão, resumo semanal por assinatura
│   │   ├── moderacao/       # pipeline de IA (texto + imagem), comentários, cortes de pontuação, estatísticas e filas
│   │   ├── imagens/         # phash, EXIF, desfoque de rosto/placa, validação por conteúdo, upload (Vercel Blob)
│   │   ├── reclamacoes/     # protocolo (UG-AAAA-NNNNNNN), status públicos, avaliação, limites de imagem, categorias traduzidas
│   │   ├── orgaos/          # categorias atendidas, reputação, sinais de validação e correção de resposta
│   │   └── util/            # datas (fuso de Brasília) e números formatados, tempo relativo, paginação, slug, URL base
│   └── types/
├── e2e/                     # testes end-to-end (Playwright) e helpers de dados de teste
├── messages/                # textos pt-BR e en (inclui o namespace Email)
├── scripts/                 # auditar-dependencias.mjs (gate de auditoria do CI)
├── docs/                    # banner e capturas de tela deste README
├── .github/workflows/       # CI: verificar + e2e
├── .claude/skills/          # skills do projeto (design, UX, backend, testes); ver "Design e skills do projeto"
├── docker-compose.yml
├── vercel.json              # cron do resumo semanal
└── .env.example
```

</details>

---

## Segurança e privacidade

### Privacidade (LGPD)

O sistema trata dados pessoais e observa a Lei Geral de Proteção de Dados (Lei nº 13.709/2018):

- Consentimento explícito aos Termos de Uso e à Política de Privacidade no cadastro (`/termos`)
- Coleta mínima de dados no cadastro
- O CPF nunca é guardado em texto: só um hash (HMAC-SHA256); documentos de identificação, quando utilizados na verificação, ficam apenas em forma de hash
- Imagens submetidas passam por detecção de rostos e placas veiculares, com desfoque automático
- "Minha conta" permite trocar senha e e-mail, ativar o 2FA, baixar os próprios dados (JSON) e excluir a conta. O nome não é editável, de propósito: ele identifica o autor em comentários e o responsável cadastrado do órgão
- Exclusão de conta disponível ao usuário: anonimiza os dados pessoais; reclamações já publicadas são mantidas como registro de interesse público, sem identificação do autor
- Registros de moderação mantidos para fins de auditoria e recurso

### Autenticação em duas etapas

Qualquer usuário pode ativar 2FA por aplicativo autenticador (Google Authenticator, Authy etc.) em "Minha conta". O segredo TOTP é cifrado em repouso (AES-256-GCM, chave derivada de `AUTH_SECRET`): nunca fica em texto puro no banco. Um código já usado não vale de novo na mesma janela de 30 segundos. Códigos de backup de uso único cobrem a perda do dispositivo, e o login bloqueia temporariamente após 5 tentativas de código incorretas. Para contas de **órgão** o 2FA é obrigatório: sem ele, o login leva direto a "Minha conta" para ativá-lo, o painel não abre e o formulário de resposta oficial vira um aviso com o link (a conta não consegue desativá-lo). A sessão é recalculada a cada leitura, então ativar libera o painel na mesma sessão. Quem perde o aplicativo e os códigos de backup pede a um administrador que redefina o segundo fator (em Órgãos, com a senha e o código do próprio admin): a conta perde o segredo, os códigos e as sessões abertas, o fato fica registrado na auditoria, a pessoa é avisada por sininho e e-mail e volta a entrar só com a senha, sendo levada a ativá-lo de novo. SMS e e-mail como segundo fator ainda não foram implementados: dependem da escolha de um provedor.

### Acesso de órgão

Contas de órgão não são autoatendimento como a de cidadão: uma prefeitura ou secretaria solicita acesso em `/cadastro`, alternando para o modo "Órgão público" num switch animado (também acessível direto em `/orgao/solicitar`, que redireciona para lá), informa nome, cidade, **CNPJ** (numérico ou o alfanumérico da Receita, com os dígitos verificadores conferidos), **site oficial**, responsável e contato, e a conta só é criada depois que um **ADMIN** aprova o pedido em `/solicitacoes-orgao`. Na aprovação, o solicitante recebe um e-mail com link de uso único para definir a senha. Essa restrição existe porque uma conta de órgão pode postar "resposta oficial" em nome da prefeitura, o mesmo nível de confiança já exigido para banir usuário. O `seed.ts` continua criando um órgão de demonstração pronto (veja `SEED_ORGAO_EMAIL` e `SEED_ORGAO_SENHA`), útil para testar sem passar pelo fluxo de aprovação.

Ao decidir um pedido, o ADMIN vê no cartão o que confere: o tipo do domínio do e-mail (institucional `.gov.br`/`.leg.br`…, pessoal ou próprio), se **já existe um órgão com aquele nome na cidade** (aprovar adiciona a conta nova a ele, sem criar outro) se aquele e-mail já teve um pedido rejeitado, se o **CNPJ já está cadastrado em outro órgão** e como o **site informado** se relaciona com o e-mail (site institucional, no mesmo domínio do e-mail ou em outro). O botão "Consultar CNPJ na Receita" chama a BrasilAPI pelo servidor, só para o admin e com limite por hora, e mostra a situação cadastral e se a natureza jurídica é de administração pública; o resultado não é guardado e, se o serviço estiver fora, a decisão segue livre. São indícios, não comprovação: o nome e o e-mail são digitados por quem pede, e o vínculo deve ser conferido no site oficial do órgão ou por telefone. Quem deixa o convite vencer (vale 24 h) pede outro na própria página do link.

A conta de órgão entra direto em `/orgao`, onde as reclamações aparecem em duas filas, **sem resposta** e **em acompanhamento** (já respondidas e ainda abertas), com busca por protocolo ou título e filtro de categoria. Ela **não registra nem avalia reclamação** e não responde ao que uma conta do próprio órgão abriu (a reputação pública não pode ser inflada por quem a recebe). Quando o autor contesta uma resolução ("não foi resolvido"), a reclamação **reabre**, o órgão é avisado e, resolvida de novo, o autor avalia outra vez.

A resposta oficial é registro público, então **não se reescreve**: o órgão pode corrigir o erro de quem acabou de enviar (texto e prazo) por 15 minutos, só na resposta mais recente da reclamação e antes de o autor avaliar a resolução, e a correção aparece marcada como "Editada em…". Passada a janela, o caminho é enviar uma nova resposta, e a anterior continua visível na linha do tempo.

Por padrão, um órgão vê e pode responder qualquer reclamação da sua cidade. Um **ADMIN** pode restringir isso em `/orgaos-categorias`, atribuindo categorias específicas a cada órgão (ex.: só "Buracos e pavimentação" para a Secretaria de Obras): um órgão sem nenhuma categoria atribuída continua no comportamento padrão (atende tudo).

### Integridade de conta e antifake

Como a plataforma lida com reclamações sobre a cidade, incluindo, indiretamente, sobre a gestão pública, ela é um alvo natural de manipulação coordenada (contas falsas para inflar ou forjar corroboração comunitária). As medidas atuais são de integridade de conta e de comportamento, não de moderação de conteúdo político:

- CPF único por conta (hash) e Cloudflare Turnstile no cadastro (opcional)
- Limite de contas criadas por IP e de reclamações e denúncias por usuário
- E-mail verificado obrigatório para confirmar ("também sofro com isso") e denunciar, com contas anteriores à regra isentas
- Rajada de confirmações fora do padrão gera alerta para moderador/admin, nunca ação automática: um problema real pode legitimamente viralizar, então a decisão final é sempre humana
- Denúncia de conteúdo publicado (`/denuncias`) e banimento de usuário (restrito a ADMIN) como consequência
- Mudar o papel de uma conta, banir de forma permanente e aprovar um órgão pedem a **senha e o código de duas etapas de quem age** (conferidos no servidor, com o mesmo bloqueio por tentativas do login); a pessoa afetada recebe um aviso no sino
- **Registro de auditoria** (`RegistroAuditoria`, tela `/auditoria`, só ADMIN): quem mudou papel, baniu ou reverteu banimento, ativou ou desativou órgão e aprovou ou rejeitou solicitações, gravado na mesma transação da mudança, sem copiar nome ou e-mail

### Segurança de aplicação

- Acesso a banco de dados 100% via Prisma (query builder parametrizado): não há SQL bruto em nenhum ponto do código, então injeção de SQL não é uma superfície de ataque válida aqui.
- Cada página de admin, moderação e do painel de órgão verifica o papel do usuário no próprio server component (sem layout compartilhado); `src/proxy.ts` é uma camada extra de defesa em profundidade que barra por papel antes mesmo da página carregar, cobrindo o caso de uma página nova esquecer de chamar seu guard. Não substitui a checagem de cada server action: o próprio código do Next avisa que uma Server Function é só um POST para a rota onde ela é usada, então a checagem tem que valer por si só também.
- Bloqueio temporário por força bruta de senha (`loginTentativasFalhas`/`loginBloqueadoAte` no `User`, 5 tentativas em 15 min), independente do bloqueio já existente para código TOTP.
- Limite de solicitações por IP/hora em endpoints públicos que gravam no banco (cadastro de conta, solicitação de acesso de órgão).
- **Limite de abuso compartilhado entre instâncias** para o que manda e-mail ou mexe em credencial (redefinir senha, reenviar verificação, trocar e-mail, novo link de convite): o contador mora no banco (`LimiteAbuso`), porque em serverless cada função teria o seu e quem martela o botão nunca chegaria ao limite. A chave é gravada como HMAC, nunca o IP ou o e-mail em claro. As consultas de leitura chamadas a cada tecla (CEP, busca de cidade) seguem com limite em memória.
- O login só segue um `callbackUrl` que seja caminho interno do próprio site (nunca `//host` ou URL absoluta), para não virar redirecionamento aberto.
- Notificações do sino e e-mails saem no idioma de quem recebe (`User.idioma`), não no de quem disparou a ação.
- Todo campo de texto livre em formulários tem tamanho máximo validado via Zod (não só mínimo): evita payloads desproporcionais e custo desnecessário com a API de IA.
- Cabeçalhos HTTP de segurança (`next.config.ts`): Content-Security-Policy, X-Frame-Options, X-Content-Type-Options, Referrer-Policy e Permissions-Policy em todas as rotas.
- Moderação por IA (`lib/moderacao`, `lib/moderacao/comentario`): o texto do usuário é isolado no prompt por marcadores explícitos com instrução para nunca seguir comandos embutidos nele (mitiga prompt injection), e a resposta do modelo é revalidada com Zod (não só o `responseSchema` do Gemini): qualquer score fora de 0-1 ou formato inesperado falha para revisão humana em vez de aprovar por engano ou travar a reclamação sem rastro.
- **Dependências auditadas no CI**: `scripts/auditar-dependencias.mjs` roda `npm audit --omit=dev` e barra o PR com advisory alto ou crítico fora da lista de exceções.
- DDoS volumétrico (inundação de tráfego na camada de rede) não é algo que código de aplicação resolve sozinho: isso depende de proteção na borda (Cloudflare, WAF do provedor de hospedagem etc.); o que este projeto controla é o abuso a nível de aplicação (força bruta, spam de formulário, payloads grandes).

---

## Design e skills do projeto

A interface segue a identidade **"sinalização urbana + planta"**: papel azul-acinzentado e tinta quase preta, azul de placa como única cor interativa, amarelo de obra como acento raro, títulos em Archivo e protocolos e números em IBM Plex Mono. Todas as cores são tokens semânticos (`paper`, `surface`, `ink`, `line`, `brand`, `signal`...) que trocam sozinhos no modo escuro; ver `src/app/globals.css`. Os e-mails usam a mesma identidade (`src/lib/email/layout.ts`) e saem com versão em texto; `npm run email:previa` mostra todos nos dois idiomas.

O repositório traz **skills** para quem desenvolve com o Claude Code (pasta `.claude/skills/`):

| Skill | Para quê |
|---|---|
| `frontend-design` | Identidade visual, tokens, componentes base, tiques a evitar |
| `ux-writing` | Tom de voz, vocabulário fixo, mensagens, i18n pt-BR/en |
| `acessibilidade` | WCAG 2.2 AA: contraste, foco, formulários, teclado, varredura axe |
| `email-transacional` | Arquitetura e regras de e-mail (tabelas, modo escuro, Outlook, segurança) |
| `verificacao-visual` | Screenshots em claro/escuro/375px e script de captura |
| `server-actions` | Padrões de Server Actions, guards, validação, corrida |
| `prisma-mysql` | Schema, migrations, consultas, MySQL/TiDB |
| `seguranca-app` | LGPD, login/2FA, CSP, upload, e-mail, moderação por IA |
| `testes` | Vitest, Playwright, armadilhas de teste |
| `21st-dev`, `reactbits`, `uiverse` | Como adaptar componentes de catálogos externos |

---

## Contribuindo

Commits diretos na `main` não são permitidos. Cada funcionalidade é desenvolvida em sua própria branch.

```bash
git checkout main
git pull

git checkout -b feat/nome-da-funcionalidade
# desenvolvimento
git add .
git commit -m "feat: descrição da alteração"
git push -u origin feat/nome-da-funcionalidade
```

Em seguida, abra um Pull Request no GitHub para revisão antes do merge. O CI (tipos, lint, testes, auditoria e a suíte E2E) precisa estar verde.

### Convenção de mensagens

| Prefixo | Uso |
|---|---|
| `feat:` | Nova funcionalidade |
| `fix:` | Correção de bug |
| `refactor:` | Reestruturação sem mudança de comportamento |
| `docs:` | Documentação |
| `chore:` | Configuração, dependências, infraestrutura |
| `test:` | Testes |

### Sincronização do banco entre desenvolvedores

Cada desenvolvedor executa seu próprio container de MySQL local. A estrutura do banco é sincronizada pelas migrations, que são versionadas no repositório.

Ao alterar o `schema.prisma`, gere a migration e a inclua no commit:

```bash
npx prisma migrate dev --name descricao_da_alteracao
git add prisma/
```

Ao receber alterações de outro desenvolvedor:

```bash
git pull
npm install
npx prisma migrate dev
```

Arquivos de dump ou backup do banco **não** devem ser versionados.

---

## Problemas comuns

<details>
<summary><code>P1001: Can't reach database server</code></summary>

<br>

O container não está em execução. Rode `docker compose up -d` e aguarde alguns segundos. Verifique também se o Docker Desktop está aberto.

</details>

<details>
<summary><code>port 3306 is already allocated</code></summary>

<br>

Outro serviço MySQL ocupa a porta, geralmente XAMPP ou uma instalação local. Encerre esse serviço ou altere a porta no `docker-compose.yml` para `"3307:3306"`, ajustando a `DATABASE_URL` para `localhost:3307`.

</details>

<details>
<summary><code>docker: command not found</code></summary>

<br>

O Docker Desktop não está instalado ou o terminal foi aberto antes da instalação. Reinicie o terminal; se persistir, reinicie o computador.

</details>

<details>
<summary><code>Prisma config detected, skipping environment variable loading</code></summary>

<br>

Existe um arquivo `prisma.config.ts` na raiz do projeto, resíduo de uma versão mais recente do Prisma. Ele impede a leitura do `.env`. Remova o arquivo.

</details>

<details>
<summary>Erro de tipo após alterar o <code>schema.prisma</code></summary>

<br>

O Prisma Client precisa ser regenerado: `npx prisma generate`. Desde o Prisma 7 ele é gerado dentro do projeto (`src/generated/prisma`, fora do git) e **não** é mais regenerado sozinho pelo `migrate dev`; o `npm install` o gera (script `postinstall`).

</details>

<details>
<summary><code>EPERM</code> ao rodar <code>prisma generate</code>, <code>prisma migrate dev</code> ou <code>npm ci</code> (Windows)</summary>

<br>

O `npm run dev` mantém abertos os binários nativos do Next (e do `sharp`), e o Windows não deixa substituí-los. Pare o servidor de desenvolvimento, rode o comando e suba o servidor de novo. O mesmo vale depois de atualizar dependências: pare o servidor, `npm ci`, reinicie. (O Prisma 7 não traz mais o motor nativo que travava o `prisma generate`.)

</details>

<details>
<summary><code>Another next dev server is already running</code></summary>

<br>

Já existe um `npm run dev` rodando neste projeto. Use o que está aberto (ou pare-o) em vez de subir um segundo; para outra instância de teste, rode um build de produção em outra porta (ver [Testes](#testes)).

</details>

<details>
<summary><code>Build Error: Can't resolve '@vercel/turbopack-next/internal/font/google/font'</code> no <code>npm run dev</code></summary>

<br>

O Turbopack perdeu o estado das fontes do Google (`next/font/google`), em geral depois de recompilações simultâneas ou de uma falha de rede ao baixá-las. A configuração das fontes não tem problema. Pare o servidor, apague a pasta `.next/dev` (é só cache de build, regenerada sozinha) e rode `npm run dev` de novo. Se o terminal avisar "Failed to download ... from Google Fonts. Using a fallback font", a rede falhou no arranque: reinicie mais uma vez para baixar as fontes de verdade.

</details>

<details>
<summary>Todo login falha ou todo teste que entra numa conta dá timeout (<code>UntrustedHost</code>)</summary>

<br>

Fora do `npm run dev` (e fora da Vercel), o Auth.js só confia no host se `AUTH_TRUST_HOST=true` estiver definido. Rode o build de produção com `AUTH_TRUST_HOST=true npx next start -p 3001`.

</details>

<details>
<summary>Teste E2E de cadastro trava ou falha com "Não foi possível confirmar que você não é um robô"</summary>

<br>

O Turnstile está configurado no `.env` e bloqueou corretamente o navegador automatizado do Playwright. Comente `NEXT_PUBLIC_TURNSTILE_SITE_KEY` e `TURNSTILE_SECRET_KEY`, reinicie o servidor e rode os testes de novo (ver [Testes](#testes)).

</details>

---

## Limites e próximos passos

**Limites conhecidos**

- A IA aponta indícios; não confirma que o problema existe (ver a nota metodológica em [Moderação por IA](#moderação-por-ia)).
- Órgãos são validados por sinais (tipo de domínio do e-mail, órgão já cadastrado, rejeições anteriores, CNPJ e site informados, consulta pública do CNPJ), não por documentos: o vínculo entre quem pede e o órgão ainda é conferido por fora pelo administrador. A consulta depende de um serviço público externo e nunca bloqueia a decisão.
- O segundo fator é só por aplicativo autenticador (sem SMS, e-mail nem chave de segurança). É obrigatório para contas de órgão, mas continua opcional para as demais.
- O prazo de 15 dias sem resposta, que pesa na reputação, é único para a plataforma: não distingue categoria nem urgência. E a regra só vale daqui para frente: os órgãos que já existiam começam sem passivo.
- O aviso em tempo real ao órgão é só no sino (o e-mail seria spam em cidade grande); o e-mail é o resumo semanal.

**Próximos passos**

- Prazo de resposta por categoria ou urgência na reputação (hoje são 15 dias para tudo).
- Conferir o vínculo do órgão por uma fonte oficial além do CNPJ informado.
- Outros segundos fatores (chave de segurança, passkeys).

---

## Ambiente de desenvolvimento recomendado

Extensões sugeridas para o VSCode:

| Extensão | Função |
|---|---|
| Prisma | Destaque de sintaxe e autocomplete no schema |
| ESLint | Análise estática |
| Prettier | Formatação automática |
| Tailwind CSS IntelliSense | Autocomplete de classes |
| GitLens | Histórico de alterações por linha |

---

## Autoria

Trabalho de Conclusão de Curso desenvolvido em dupla por:

- **Matheus Tonon dos Reis** ([@matheustonon1](https://github.com/matheustonon1))
- **Pablo Aragão Amaral Almeida**

---

## Licença

MIT © 2026 Matheus Tonon dos Reis e Pablo Aragão Amaral Almeida. Texto completo em [LICENSE](LICENSE).

<div align="center">
  <br>
  <sub>Urban Grid · Trabalho de Conclusão de Curso</sub>
</div>
