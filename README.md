# Urban Grid

> Plataforma web de reclamações urbanas por município, com moderação de conteúdo assistida por Inteligência Artificial.

Trabalho de Conclusão de Curso.

---

## Sobre o projeto

O sistema permite que cidadãos registrem reclamações sobre problemas urbanos do seu município — buracos na via, iluminação pública, coleta de lixo, saneamento, transporte — anexando texto e imagens. Órgãos públicos cadastrados podem responder oficialmente e atualizar o status de cada ocorrência, e os cidadãos avaliam se o problema foi de fato resolvido.

Além do fluxo básico de reclamação → moderação → resposta oficial, a plataforma inclui:

- **Feed público por cidade**, com filtros por categoria/status e ordenação por recência ou confirmações da comunidade ("também sofro com isso")
- **Reputação pública por órgão**, nos moldes do Reclame Aqui: selo (Ótimo/Bom/Regular/Ruim) calculado a partir do índice de resolução, tempo médio de resposta e nota dos cidadãos
- **Comentários em cada reclamação**, moderados por IA, com fila de revisão humana para corrigir falsos positivos sem depender só da decisão automática
- **Autenticação em duas etapas (TOTP)** por aplicativo autenticador, com códigos de backup de uso único
- **Tema claro/escuro** com preferência persistida por usuário
- **Cadastro de órgão com aprovação**: prefeituras/secretarias solicitam acesso publicamente, um ADMIN aprova ou rejeita, e só então a conta é criada e um link de definição de senha é enviado
- **Dashboard de estatísticas de moderação** com período selecionável (7, 30, 90 dias ou tudo) e comparação com o período anterior: decisões da IA, fila de espera por idade, volume ao longo do tempo, distribuição das pontuações, critérios que mais disparam revisão, quanto os moderadores discordam da IA (reclamações enviadas à revisão e reprovações de comentário revertidas), denúncias, versões do prompt e consumo do modelo. Cada gráfico tem uma versão em tabela
- **Formulário de reclamação guiado**: etapas numeradas, categorias à vista, preenchimento de endereço pelo CEP, fotos com arrastar e soltar, progresso e dicas ao lado; um erro de validação nunca apaga o que a pessoa já escreveu
- **Recurso contra rejeição**: o autor pode contestar uma vez a rejeição de uma reclamação, encaminhando-a para revisão humana com o motivo original e o argumento do autor lado a lado
- **Notificação por e-mail nos eventos-chave** (reclamação publicada/rejeitada, resposta oficial, pedido de avaliação, arquivamento por denúncia) além do sininho in-app — só para quem já verificou o e-mail

O diferencial técnico é o **pipeline de moderação automatizada**: todo conteúdo submetido passa por uma sequência de verificações antes de ser publicado, combinando checagens determinísticas com análise por modelo de linguagem multimodal.

### O que a moderação verifica

| Camada | Verificação |
|---|---|
| Pré-checagens | Limite de envios por usuário, tipo e tamanho do arquivo, hash perceptual da imagem (detecção de repostagem), metadados EXIF (data e geolocalização da foto) |
| Análise de texto | Conteúdo ofensivo ou discurso de ódio, spam, exposição de dados pessoais de terceiros, conteúdo fora do escopo municipal, indícios de desinformação |
| Análise de imagem | Conteúdo impróprio, presença de rostos ou placas legíveis, e coerência entre o que a imagem mostra e o que o texto descreve |
| Decisão | Publicação automática, encaminhamento para revisão humana ou rejeição com justificativa e direito a recurso |

Todas as decisões são registradas com o retorno do modelo, a versão do prompt utilizada e a latência, permitindo auditoria e análise posterior de precisão.

### Nota metodológica sobre desinformação

O sistema **não verifica fatos**. Nenhum modelo de linguagem consegue confirmar se existe de fato um buraco em determinada rua. O que o pipeline detecta são **indícios** de conteúdo não confiável — incoerência entre imagem e texto, metadados inconsistentes, imagem reciclada de outra ocorrência, linguagem sensacionalista, alegações amplas não verificáveis.

A validação factual é delegada a um mecanismo de **corroboração comunitária**: confirmações independentes de outros usuários verificados do mesmo município elevam o grau de confiabilidade da denúncia.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Front-end | React via Next.js (App Router), TypeScript |
| Estilização | Tailwind CSS v4 com design system próprio (tokens semânticos claro/escuro em `globals.css`, sem biblioteca de componentes); fontes Archivo, IBM Plex Sans e IBM Plex Mono |
| Back-end | Next.js Route Handlers e Server Actions |
| Banco de dados | MySQL 8.4 |
| ORM | Prisma 6 |
| Autenticação | Auth.js (NextAuth), login por e-mail ou CPF |
| Moderação | API de LLM multimodal (Gemini) |
| Armazenamento de imagem | Vercel Blob |
| Processamento de imagem | sharp (redimensionamento/desfoque), blockhash-core (hash perceptual), exifr (metadados EXIF) |
| Autenticação em duas etapas | otplib (TOTP) + qrcode (QR code de configuração) |
| Envio de e-mail | Resend (opcional — sem chave configurada, o texto do e-mail, com o link, fica no log do servidor). Layout próprio de e-mail (HTML de tabelas, modo escuro, versão em texto) em `src/lib/email/` |
| Antifake no cadastro | Cloudflare Turnstile (opcional) |
| Testes | Vitest (unitários) + Playwright (end-to-end) + axe-core (varredura de acessibilidade) |
| Infraestrutura local | Docker Compose |

As versões do Prisma estão fixadas propositalmente. A CLI passou por reestruturação em versões posteriores, com mudança de comandos e de formato de configuração. Fixar a versão garante reprodutibilidade do ambiente ao longo do desenvolvimento e na avaliação do trabalho.

---

## Pré-requisitos

- **Node.js** 20 ou superior — [nodejs.org](https://nodejs.org)
- **Docker Desktop** — [docker.com](https://www.docker.com/products/docker-desktop)
- **Git** — [git-scm.com](https://git-scm.com)

Não é necessário instalar MySQL na máquina. O banco roda em container.

Para verificar se está tudo disponível:

```bash
node --version
docker --version
git --version
```

---

## Instalação

### 1. Clonar o repositório

```bash
git clone https://github.com/SEU_USUARIO/urban-grid.git
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

Abra o `.env` e preencha:

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

O `BLOB_READ_WRITE_TOKEN` é necessário para o upload de imagem nas
reclamações. Crie um Blob store gratuito em
[vercel.com](https://vercel.com) → Storage → Create → Blob e copie o
token — funciona em desenvolvimento local, não é preciso publicar o
projeto na Vercel para testar. Sem essa variável, o restante do app
funciona normalmente; só o envio de fotos falha.

`NEXT_PUBLIC_APP_URL` é opcional (usada para montar o link no e-mail de
verificação de conta, e as URLs absolutas em `robots.txt`/`sitemap.xml`).
Default: `http://localhost:3000` — **em produção, configure com o domínio
real**, senão o sitemap aponta pro localhost.

`RESEND_API_KEY` e `RESEND_FROM_EMAIL` são opcionais — ativam o envio
real do e-mail de verificação via [Resend](https://resend.com) (plano
grátis: 3.000 e-mails/mês). Sem `RESEND_API_KEY`, o link de verificação
só aparece no log do servidor, o que já é suficiente para desenvolver.
Sem domínio próprio verificado no Resend, `RESEND_FROM_EMAIL` pode ficar
em branco (usa `onboarding@resend.dev`), mas nesse caso só entrega para
o e-mail cadastrado na sua conta Resend.

`NEXT_PUBLIC_TURNSTILE_SITE_KEY` e `TURNSTILE_SECRET_KEY` são opcionais
(proteção antifake no cadastro) — crie uma chave grátis em
[dash.cloudflare.com](https://dash.cloudflare.com) → Turnstile → Add
site. Sem essas variáveis, o cadastro funciona normalmente, só sem
verificação de bot.

O arquivo `.env` está no `.gitignore` e **nunca deve ser versionado**.

### 4. Subir o banco de dados

Com o Docker Desktop aberto:

```bash
docker compose up -d
```

A primeira execução baixa a imagem do MySQL (aproximadamente 500 MB). Verifique se o container subiu:

```bash
docker compose ps
```

O container `reclame_mysql` deve aparecer com status `Up`. Aguarde cerca de 20 segundos após a primeira subida — o MySQL leva um tempo para concluir a inicialização interna.

### 5. Aplicar as migrations

```bash
npx prisma migrate dev
```

Isso cria todas as tabelas do sistema no banco.

### 6. Popular os dados iniciais

```bash
npx prisma db seed
```

Carrega os municípios e as categorias de reclamação.

### 7. Iniciar a aplicação

```bash
npm run dev
```

Acesse **http://localhost:3000**

---

## Comandos de uso frequente

### Aplicação

```bash
npm run dev      # ambiente de desenvolvimento
npm run build    # build de produção
npm run start    # executa o build
npm run lint     # verificação de código
npm test         # testes unitários (Vitest)
npm run test:e2e # testes end-to-end (Playwright) - ver seção abaixo
npm run email:previa # gera o HTML de todos os e-mails em .email-previa/ (abra no navegador)
npm run db:seed:demo # reclamações de demonstração para ver o site como órgão (-- --limpar remove)
```

O GitHub Actions (`.github/workflows/ci.yml`) roda tipos (`tsc`), lint e testes unitários a cada
push na `main` e a cada PR. O E2E precisa de MySQL e das variáveis do app e continua local.

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
npx prisma generate                  # regenera o client após alterar o schema
```

### Testes end-to-end (Playwright)

Os testes em `e2e/` exercitam fluxos completos pelo navegador contra um
servidor real (não usam mocks) - cadastro/login, bloqueio por força
bruta, ciclo completo do 2FA, órgão restrito por categoria, recurso
contra rejeição, onboarding de órgão de ponta a ponta, denúncia/banimento,
avaliação de resolução, exclusão de conta, confirmação ("também sofro
com isso"), formulário de nova reclamação e estatísticas de moderação.
Cada teste cria seus próprios dados (usuários com e-mail
prefixado `e2e-teste-*`, reclamações com protocolo prefixado) e limpa
tudo ao final, então é seguro rodar contra o banco de desenvolvimento
normal.

Nenhum teste passa pelo fluxo real de criação de reclamação com upload
de imagem (usam `criarReclamacaoTeste()`, direto no banco) - isso evitaria
chamar a API do Gemini e o Vercel Blob de verdade a cada execução. Os
testes do formulário de nova reclamação só inspecionam a requisição de
envio (as fotos escolhidas vão nela) e a abortam antes de chegar ao servidor.

O banco de testes é o mesmo do desenvolvimento, que já tem análises de
moderação de verdade: os testes de estatísticas comparam o número antes e
depois de semear dados, nunca um valor absoluto.

**Se `NEXT_PUBLIC_TURNSTILE_SITE_KEY`/`TURNSTILE_SECRET_KEY` estiverem
configuradas no `.env`**, os testes de cadastro em `auth.spec.ts` falham:
a Cloudflare bloqueia corretamente o navegador automatizado do Playwright
(é o antifake funcionando como deveria). Pra rodar a suíte completa,
comente essas duas variáveis no `.env` antes e reinicie o `npm run dev`
- descomente depois pra voltar a testar o widget manualmente.

Pré-requisitos (o Playwright não sobe nada disso sozinho):

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

Também é possível rodar a suíte contra um **build de produção em outra porta**, sem
mexer no `npm run dev` aberto (mais estável e zera os limites por IP em memória):

```bash
npx next build
AUTH_TRUST_HOST=true npx next start -p 3001    # AUTH_TRUST_HOST é obrigatório fora do dev
PLAYWRIGHT_BASE_URL=http://localhost:3001 npx playwright test
```

`e2e/acessibilidade.spec.ts` faz uma varredura axe-core nas telas principais, em claro e
escuro, e falha em violação grave (contraste, campo sem rótulo, landmark duplicado).

Rodam com 1 worker (`playwright.config.ts`) de propósito: os testes
escrevem no mesmo banco compartilhado, então paralelismo entre arquivos
causaria corrida (ex.: dois testes usando a fila de `/moderacao` ao
mesmo tempo).

O servidor de desenvolvimento guarda limites por IP em memória (por exemplo,
5 pedidos de redefinição de senha por hora). Rodar a suíte inteira várias
vezes seguidas faz `redefinir-senha` e `seguranca-sessao` falharem sem ser
regressão: reinicie o `npm run dev` (ou espere uma hora) para zerar.

### Recomeçar o banco do zero

Útil quando o banco local fica inconsistente. Apaga **todos** os dados:

```bash
docker compose down -v
docker compose up -d
npx prisma migrate dev
npx prisma db seed
```

---

## Estrutura de pastas

```
urban-grid/
├── prisma/
│   ├── schema.prisma        # modelo de dados
│   ├── migrations/          # histórico versionado do banco
│   └── seed.ts              # dados iniciais (geografia, categorias, admin/órgão demo)
├── src/
│   ├── app/
│   │   ├── (auth)/          # login (com 2FA), cadastro e verificação de e-mail
│   │   ├── (app)/           # área autenticada (painel, conta + 2FA, reclamações, órgão)
│   │   ├── (admin)/         # moderação humana, estatísticas, denúncias e aprovação de órgão
│   │   ├── cidades/         # feed público por cidade (filtros, ranking de órgãos, índice de resolução)
│   │   ├── orgaos/          # perfil público de reputação por órgão
│   │   ├── orgao/           # solicitação pública de acesso e definição de senha
│   │   ├── reclamacoes/     # feed público global (busca por cidade/palavra-chave)
│   │   ├── termos/          # Termos de Uso e Política de Privacidade
│   │   └── api/             # rotas de API (busca de cidade, consulta de CEP)
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
│   │   ├── seguranca/       # CPF (hash), TOTP + códigos de backup, limite de tentativas, Turnstile, limite por IP, guard de sessão
│   │   ├── acoes/           # retorno padrão das Server Actions (`ResultadoAcao`) e reautenticação por senha em ações que mudam acesso
│   │   ├── conta/           # identificador (e-mail/CPF), verificação de e-mail, senha atual, exportação de dados (LGPD)
│   │   ├── email/           # tokens, templates, layout HTML, envio (Resend) e prévia - ver o index.ts
│   │   ├── notificacoes/    # notificações in-app + e-mail e resumo semanal por assinatura
│   │   ├── moderacao/       # pipeline de IA (texto + imagem), comentários, cortes de pontuação, estatísticas e filas
│   │   ├── imagens/         # phash, EXIF, desfoque de rosto/placa, validação por conteúdo, upload (Vercel Blob)
│   │   ├── reclamacoes/     # protocolo (UG-AAAA-NNNNNNN), status públicos, limites de imagem, categorias traduzidas
│   │   ├── orgaos/          # categorias atendidas por órgão, métricas e selo de reputação
│   │   └── util/            # datas e números formatados, tempo relativo, paginação, slug, URL base
│   └── types/
├── e2e/                     # testes end-to-end (Playwright) e helpers de dados de teste
├── messages/                # textos pt-BR e en (inclui o namespace Email)
├── .claude/skills/          # skills do projeto (design, UX, backend, testes) - ver "Skills do projeto"
├── docker-compose.yml
└── .env.example
```

---

## Design e skills do projeto

A interface segue a identidade **"sinalização urbana + planta"**: papel azul-acinzentado e
tinta quase preta, azul de placa como única cor interativa, amarelo de obra como acento raro,
títulos em Archivo e protocolos/números em IBM Plex Mono. Todas as cores são tokens semânticos
(`paper`, `surface`, `ink`, `line`, `brand`, `signal`...) que trocam sozinhos no modo escuro -
ver `src/app/globals.css`. Os e-mails usam a mesma identidade (`src/lib/email/layout.ts`) e
saem com versão em texto; `npm run email:previa` mostra todos nos dois idiomas.

O repositório traz **skills** para quem desenvolve com o Claude Code (pasta `.claude/skills/`):

| Skill | Para quê |
|---|---|
| `frontend-design` | identidade visual, tokens, componentes base, tiques a evitar |
| `ux-writing` | tom de voz, vocabulário fixo, mensagens, i18n pt-BR/en |
| `acessibilidade` | WCAG 2.2 AA: contraste, foco, formulários, teclado, varredura axe |
| `email-transacional` | arquitetura e regras de e-mail (tabelas, modo escuro, Outlook, segurança) |
| `verificacao-visual` | screenshots em claro/escuro/375px e script de captura |
| `server-actions` | padrões de Server Actions, guards, validação, corrida |
| `prisma-mysql` | schema, migrations, consultas, MySQL/TiDB |
| `seguranca-app` | LGPD, login/2FA, CSP, upload, e-mail, moderação por IA |
| `testes` | Vitest, Playwright, armadilhas de teste |
| `21st-dev`, `reactbits`, `uiverse` | como adaptar componentes de catálogos externos |

---

## Fluxo de trabalho com Git

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

Em seguida, abra um Pull Request no GitHub para revisão antes do merge.

### Convenção de mensagens

| Prefixo | Uso |
|---|---|
| `feat:` | nova funcionalidade |
| `fix:` | correção de bug |
| `refactor:` | reestruturação sem mudança de comportamento |
| `docs:` | documentação |
| `chore:` | configuração, dependências, infraestrutura |
| `test:` | testes |

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

**`P1001: Can't reach database server`**
O container não está em execução. Rode `docker compose up -d` e aguarde alguns segundos. Verifique também se o Docker Desktop está aberto.

**`port 3306 is already allocated`**
Outro serviço MySQL ocupa a porta, geralmente XAMPP ou uma instalação local. Encerre esse serviço ou altere a porta no `docker-compose.yml` para `"3307:3306"`, ajustando a `DATABASE_URL` para `localhost:3307`.

**`docker: command not found`**
O Docker Desktop não está instalado ou o terminal foi aberto antes da instalação. Reinicie o terminal; se persistir, reinicie o computador.

**`Prisma config detected, skipping environment variable loading`**
Existe um arquivo `prisma.config.ts` na raiz do projeto, resíduo de uma versão mais recente do Prisma. Ele impede a leitura do `.env`. Remova o arquivo.

**Erro de tipo após alterar o `schema.prisma`**
O Prisma Client precisa ser regenerado: `npx prisma generate`.

**`Build Error: Can't resolve '@vercel/turbopack-next/internal/font/google/font'` no `npm run dev`**
O Turbopack perdeu o estado das fontes do Google (`next/font/google`), em geral depois de recompilações simultâneas ou de uma falha de rede ao baixá-las. A configuração das fontes não tem problema. Pare o servidor, apague a pasta `.next/dev` (é só cache de build, regenerada sozinha) e rode `npm run dev` de novo. Se o terminal avisar "Failed to download ... from Google Fonts. Using a fallback font", a rede falhou no arranque: reinicie mais uma vez para baixar as fontes de verdade.

**Teste E2E de cadastro trava/falha com "Não foi possível confirmar que você não é um robô"**
O Turnstile está configurado no `.env` e bloqueou corretamente o navegador automatizado do Playwright. Comente `NEXT_PUBLIC_TURNSTILE_SITE_KEY`/`TURNSTILE_SECRET_KEY`, reinicie o `npm run dev` e rode os testes de novo (ver "Testes end-to-end" acima).

---

## Ambiente de desenvolvimento recomendado

O repositório inclui `.vscode/extensions.json` com as extensões sugeridas. O VSCode oferece a instalação automaticamente ao abrir o projeto.

| Extensão | Função |
|---|---|
| Prisma | destaque de sintaxe e autocomplete no schema |
| ESLint | análise estática |
| Prettier | formatação automática |
| Tailwind CSS IntelliSense | autocomplete de classes |
| GitLens | histórico de alterações por linha |

---

## Considerações sobre privacidade

O sistema trata dados pessoais e observa a Lei Geral de Proteção de Dados (Lei nº 13.709/2018):

- Consentimento explícito aos Termos de Uso e à Política de Privacidade no cadastro (`/termos`)
- Coleta mínima de dados no cadastro
- Documentos de identificação, quando utilizados na verificação, são armazenados apenas em forma de hash
- Imagens submetidas passam por detecção de rostos e placas veiculares, com desfoque automático
- Edição de dados cadastrais e troca de senha disponíveis em "Minha conta"
- Exclusão de conta disponível ao usuário — anonimiza os dados pessoais; reclamações já publicadas são mantidas como registro de interesse público, sem identificação do autor
- Registros de moderação mantidos para fins de auditoria e recurso

### Autenticação em duas etapas

Qualquer usuário pode ativar 2FA por aplicativo autenticador (Google
Authenticator, Authy etc.) em "Minha conta". O segredo TOTP é cifrado em
repouso (AES-256-GCM, chave derivada de `AUTH_SECRET`) — nunca fica em
texto puro no banco. Códigos de backup de uso único cobrem a perda do
dispositivo, e o login bloqueia temporariamente após 5 tentativas de
código incorretas. SMS e e-mail como segundo fator ainda não foram
implementados — dependem da escolha de um provedor.

### Acesso de órgão

Contas de órgão não são autoatendimento como a de cidadão: uma prefeitura
ou secretaria solicita acesso em `/cadastro`, alternando para o modo
"Órgão público" num switch animado (também acessível direto em
`/orgao/solicitar`, que redireciona pra lá) — informa nome, cidade,
responsável e contato —, e a conta só é criada depois que um **ADMIN**
aprova o pedido em `/solicitacoes-orgao`. Na aprovação, o solicitante
recebe um e-mail com link de uso único para definir a senha. Essa
restrição existe porque uma conta de órgão pode postar "resposta
oficial" em nome da prefeitura — o mesmo nível de confiança já exigido
para banir usuário. O `seed.ts` continua criando um órgão de demonstração
pronto (veja `SEED_ORGAO_EMAIL`/`SEED_ORGAO_SENHA`), útil para testar sem
passar pelo fluxo de aprovação, e `npm run db:seed:demo` o enche de reclamações
pendentes, em andamento e resolvidas (com e sem avaliação) para ver o painel do órgão
com movimento (entre com `demo.orgao@urbangrid.local` / `demo1234`) — `npm run db:seed:demo -- --limpar`
remove tudo que ele criou.

Por padrão, um órgão vê e pode responder qualquer reclamação da sua
cidade. Um **ADMIN** pode restringir isso em `/orgaos-categorias`,
atribuindo categorias específicas a cada órgão (ex.: só "Buracos e
pavimentação" para a Secretaria de Obras) — um órgão sem nenhuma
categoria atribuída continua no comportamento padrão (atende tudo).

### Integridade de conta e antifake

Como a plataforma lida com reclamações sobre a cidade — incluindo, indiretamente, sobre a gestão pública —, ela é um alvo natural de manipulação coordenada (contas falsas para inflar ou forjar corroboração comunitária). As medidas atuais são de integridade de conta/comportamento, não de moderação de conteúdo político:

- CPF único por conta (hash) e Cloudflare Turnstile no cadastro (opcional)
- Limite de contas criadas por IP e de reclamações/denúncias por usuário
- E-mail verificado obrigatório para confirmar ("também sofro com isso") e denunciar, com contas anteriores à regra isentas
- Rajada de confirmações fora do padrão gera alerta para moderador/admin — nunca ação automática; um problema real pode legitimamente viralizar, então a decisão final é sempre humana
- Denúncia de conteúdo publicado (`/denuncias`) e banimento de usuário (restrito a ADMIN) como consequência
- Mudar o papel de uma conta e banir de forma permanente pedem a **senha de quem age** (conferida no servidor, com o mesmo bloqueio por tentativas do login); a pessoa afetada recebe um aviso no sininho
- **Registro de auditoria** (`RegistroAuditoria`, tela `/auditoria`, só ADMIN): quem mudou papel, baniu ou reverteu banimento, ativou/desativou órgão e aprovou/rejeitou solicitações — gravado na mesma transação da mudança, sem copiar nome ou e-mail

### Segurança de aplicação

- Acesso a banco de dados é 100% via Prisma (query builder parametrizado) — não há SQL bruto em nenhum ponto do código, então injeção de SQL não é uma superfície de ataque válida aqui.
- Cada página de admin, moderação e do painel de órgão já verifica o papel do usuário no próprio server component (sem layout compartilhado); `src/proxy.ts` é uma camada extra de defesa em profundidade que barra por papel antes mesmo da página carregar, cobrindo o caso de uma página nova esquecer de chamar seu guard. Não substitui a checagem de cada server action — o próprio código do Next avisa que uma Server Function é só um POST pra rota onde ela é usada, então a checagem tem que valer por si só também.
- Bloqueio temporário por força bruta de senha (`loginTentativasFalhas`/`loginBloqueadoAte` no `User`, 5 tentativas / 15 min), independente do bloqueio já existente para código TOTP.
- Limite de solicitações por IP/hora em endpoints públicos e não autenticados que gravam no banco (cadastro de conta, solicitação de acesso de órgão).
- Notificações do sininho e e-mails saem no idioma de quem recebe (`User.idioma`), não no de quem disparou a ação.
- Todo campo de texto livre em formulários tem tamanho máximo validado via Zod (não só mínimo) — evita payloads desproporcionais e custo desnecessário com a API de IA.
- Cabeçalhos HTTP de segurança (`next.config.ts`): Content-Security-Policy, X-Frame-Options, X-Content-Type-Options, Referrer-Policy e Permissions-Policy em todas as rotas.
- Moderação por IA (`lib/moderacao`, `lib/moderacao/comentario`): o texto do usuário é isolado no prompt por marcadores explícitos com instrução para nunca seguir comandos embutidos nele (mitiga prompt injection), e a resposta do modelo é revalidada com Zod (não só o `responseSchema` do Gemini) — qualquer score fora de 0-1 ou formato inesperado falha para revisão humana em vez de aprovar por engano ou travar a reclamação sem rastro.
- DDoS volumétrico (inundação de tráfego na camada de rede) não é algo que código de aplicação resolve sozinho — isso depende de proteção na borda (Cloudflare, WAF do provedor de hospedagem, etc.); o que este projeto controla é o abuso a nível de aplicação (força bruta, spam de formulário, payloads grandes).

---

## Licença

MIT.
