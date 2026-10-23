// Dados de demonstração para ver o site pela ótica de um ÓRGÃO: reclamações
// pendentes, em andamento e resolvidas (com e sem avaliação) na cidade do órgão demo
// que o seed.ts cria, com respostas oficiais, comentários e confirmações.
//
//   npm run db:seed:demo            cria (idempotente: rodar de novo não duplica)
//   npm run db:seed:demo -- --limpar   remove tudo que este script criou
//
// Cria também um responsável do órgão demo (demo.orgao@urbangrid.local / demo1234), para
// entrar sem depender da senha que o seed.ts usou (SEED_ORGAO_SENHA). Tudo que é criado
// aqui carrega o protocolo "UG-DEMO-" ou o e-mail "demo.*@urbangrid.local", e é só isso
// que --limpar apaga.
import bcrypt from "bcryptjs";
import { PrismaClient, type StatusReclamacao } from "@prisma/client";

const prisma = new PrismaClient();

const PREFIXO_PROTOCOLO = "UG-DEMO-";
const DOMINIO = "urbangrid.local";
const SENHA_DEMO = "demo1234";
const EMAIL_ORGAO_DEMO = `demo.orgao@${DOMINIO}`;
const CODIGO_IBGE_DEMO = "3550308"; // São Paulo - SP, a cidade do órgão demo do seed.ts
const DIA_MS = 86_400_000;

const CIDADAOS = [
  "Ana Beatriz Lima",
  "João Pereira",
  "Marina Costa",
  "Carlos Souza",
  "Fernanda Alves",
  "Rafael Duarte",
];

interface RespostaDemo {
  diasAtras: number;
  texto: string;
  novoStatus?: StatusReclamacao;
  prazoEmDias?: number;
}

interface ReclamacaoDemo {
  titulo: string;
  descricao: string;
  categoria: string;
  endereco: string;
  status: StatusReclamacao;
  diasAtras: number;
  confirmacoes: number;
  comentarios?: string[];
  respostas?: RespostaDemo[];
  avaliacao?: { nota: number; resolvido: boolean; comentario?: string };
}

const RECLAMACOES: ReclamacaoDemo[] = [
  {
    titulo: "Semáforo quebrado no cruzamento da Rua 7 com a Rua 12",
    descricao:
      "O semáforo está piscando em amarelo há dias e o cruzamento virou um perigo em horário de pico. Já vi dois quase acidentes esta semana.",
    categoria: "Sinalização de trânsito",
    endereco: "Rua 7, esquina com a Rua 12",
    status: "PUBLICADA",
    diasAtras: 1,
    confirmacoes: 4,
  },
  {
    titulo: "Lixo acumulado na calçada da praça central",
    descricao:
      "A coleta não passa há mais de uma semana e o lixo está espalhado pela calçada, atraindo ratos. Moradores e comerciantes estão reclamando do cheiro.",
    categoria: "Coleta de lixo",
    endereco: "Praça da Matriz, 20",
    status: "PUBLICADA",
    diasAtras: 4,
    confirmacoes: 5,
    comentarios: ["Passei lá hoje cedo e continua igual. Já são nove dias sem coleta."],
  },
  {
    titulo: "Buraco profundo na Avenida Brasil, altura do número 1200",
    descricao:
      "Há mais de um mês existe um buraco de aproximadamente um metro de diâmetro no meio da faixa da direita. Dois carros já tiveram o pneu danificado e, à noite, quase não se enxerga. Pedimos o conserto com urgência antes que alguém se machuque.",
    categoria: "Buracos e pavimentação",
    endereco: "Avenida Brasil, 1200",
    status: "PUBLICADA",
    diasAtras: 12,
    confirmacoes: 5,
    comentarios: [
      "Quebrei a roda do carro aqui na semana passada. Seria bom sinalizar enquanto não conserta.",
      "Concordo, é um perigo para motociclistas principalmente.",
    ],
  },
  {
    titulo: "Poste de luz apagado há três semanas na Rua das Acácias",
    descricao:
      "O poste em frente ao número 120 está sem luz desde o dia 3. À noite a rua fica totalmente escura e os moradores têm medo de sair.",
    categoria: "Iluminação pública",
    endereco: "Rua das Acácias, 120",
    status: "PUBLICADA",
    diasAtras: 22,
    confirmacoes: 5,
  },
  {
    titulo: "Vazamento de esgoto na esquina da Rua das Palmeiras",
    descricao:
      "Esgoto a céu aberto escorrendo pela rua desde segunda-feira. O mau cheiro é forte e as crianças passam por ali para ir à escola.",
    categoria: "Saneamento e esgoto",
    endereco: "Rua das Palmeiras, esquina com a Rua Sete",
    status: "EM_ANDAMENTO",
    diasAtras: 9,
    confirmacoes: 4,
    respostas: [
      {
        diasAtras: 6,
        texto:
          "Equipe técnica vistoriou o local nesta segunda-feira. A recomposição da tubulação está programada para a próxima semana, com interdição parcial da faixa.",
        novoStatus: "EM_ANDAMENTO",
        prazoEmDias: 8,
      },
    ],
  },
  {
    titulo: "Calçada quebrada em frente à escola municipal",
    descricao:
      "As lajotas estão soltas e há um desnível grande na entrada da escola. Cadeirantes e idosos não conseguem passar com segurança.",
    categoria: "Acessibilidade",
    endereco: "Rua do Ensino, 85",
    status: "EM_ANDAMENTO",
    diasAtras: 15,
    confirmacoes: 3,
    respostas: [
      {
        diasAtras: 12,
        texto: "Recebemos o pedido e o trecho entrou na programação de obras de calçadas do mês.",
        novoStatus: "EM_ANDAMENTO",
        prazoEmDias: 5,
      },
    ],
  },
  {
    titulo: "Árvore com risco de queda na Rua do Comércio",
    descricao:
      "Uma árvore grande está inclinada sobre a rede elétrica e sobre as casas. Com a chuva de ontem ela cedeu mais um pouco.",
    categoria: "Praças e áreas verdes",
    endereco: "Rua do Comércio, 310",
    status: "RESOLVIDA",
    diasAtras: 20,
    confirmacoes: 3,
    respostas: [
      {
        diasAtras: 17,
        texto: "Equipe de manejo agendada para avaliar a árvore.",
        novoStatus: "EM_ANDAMENTO",
      },
      {
        diasAtras: 14,
        texto:
          "A árvore foi podada e o risco foi removido. Os galhos foram recolhidos pela equipe de limpeza.",
        novoStatus: "RESOLVIDA",
      },
    ],
    avaliacao: { nota: 5, resolvido: true, comentario: "Resolveram em poucos dias. Obrigado!" },
  },
  {
    titulo: "Entulho abandonado no terreno baldio da Rua 15",
    descricao:
      "Descartaram entulho de obra no terreno ao lado do número 40. Está bloqueando parte da calçada e acumulando água parada.",
    categoria: "Obras irregulares",
    endereco: "Rua 15, 40",
    status: "RESOLVIDA",
    diasAtras: 18,
    confirmacoes: 2,
    respostas: [
      {
        diasAtras: 13,
        texto: "Entulho recolhido pela equipe de limpeza urbana. Fiscalização notificou o responsável.",
        novoStatus: "RESOLVIDA",
      },
    ],
    avaliacao: {
      nota: 2,
      resolvido: false,
      comentario: "Recolheram a parte da calçada, mas o resto do entulho continua lá.",
    },
  },
  {
    titulo: "Ponto de ônibus sem cobertura no Bairro Novo",
    descricao:
      "O ponto não tem abrigo e as pessoas esperam o ônibus na chuva e no sol forte. Muitos idosos usam essa linha.",
    categoria: "Transporte público",
    endereco: "Avenida Central, em frente ao número 900",
    status: "RESOLVIDA",
    diasAtras: 10,
    confirmacoes: 4,
    respostas: [
      {
        diasAtras: 3,
        texto: "Abrigo instalado nesta semana pela empresa concessionária.",
        novoStatus: "RESOLVIDA",
      },
    ],
  },
];

const email = (indice: number) => `demo.cidadao${indice + 1}@${DOMINIO}`;

async function limpar() {
  const removidas = await prisma.reclamacao.deleteMany({
    where: { protocolo: { startsWith: PREFIXO_PROTOCOLO } },
  });
  // Depois das reclamações: as respostas oficiais caem junto (cascade) e liberam a FK
  // do responsável.
  const contas = await prisma.user.deleteMany({
    where: { email: { startsWith: "demo.", endsWith: `@${DOMINIO}` } },
  });
  console.log(`Demo removida: ${removidas.count} reclamações e ${contas.count} contas.`);
}

async function criar() {
  const cidade = await prisma.cidade.findUnique({ where: { codigoIbge: CODIGO_IBGE_DEMO } });
  if (!cidade) {
    throw new Error("Cidade de demonstração não encontrada - rode `npx prisma db seed` antes.");
  }

  const orgao = await prisma.orgao.findFirst({
    where: { cidadeId: cidade.id, nome: { contains: "(demo)" } },
  });
  if (!orgao) {
    throw new Error("Órgão demo não encontrado - rode `npx prisma db seed` antes.");
  }
  const senhaHash = await bcrypt.hash(SENHA_DEMO, 10);
  const usuarioOrgao = await prisma.user.upsert({
    where: { email: EMAIL_ORGAO_DEMO },
    update: { orgaoId: orgao.id },
    create: {
      email: EMAIL_ORGAO_DEMO,
      name: "Paulo Henrique Matos",
      senhaHash,
      papel: "ORGAO",
      orgaoId: orgao.id,
      cidadeId: cidade.id,
      nivelVerificacao: "EMAIL",
      emailVerified: new Date(),
      termosAceitosEm: new Date(),
    },
  });

  const categorias = await prisma.categoria.findMany();
  const categoriaPorNome = new Map(categorias.map((c) => [c.nome, c.id]));

  const cidadaos = [];
  for (const [i, nome] of CIDADAOS.entries()) {
    cidadaos.push(
      await prisma.user.upsert({
        where: { email: email(i) },
        update: {},
        create: {
          email: email(i),
          name: nome,
          senhaHash,
          papel: "CIDADAO",
          nivelVerificacao: "EMAIL",
          emailVerified: new Date(),
          termosAceitosEm: new Date(),
          cidadeId: cidade.id,
        },
      })
    );
  }

  const agora = Date.now();
  let criadas = 0;

  for (const [indice, demo] of RECLAMACOES.entries()) {
    const protocolo = `${PREFIXO_PROTOCOLO}${String(indice + 1).padStart(4, "0")}`;
    if (await prisma.reclamacao.findUnique({ where: { protocolo } })) {
      continue;
    }

    const categoriaId = categoriaPorNome.get(demo.categoria);
    if (!categoriaId) {
      throw new Error(`Categoria "${demo.categoria}" não existe - rode o seed de categorias.`);
    }
    const autor = cidadaos[indice % cidadaos.length];
    const publicadaEm = new Date(agora - demo.diasAtras * DIA_MS);
    const resolvidaEm =
      demo.status === "RESOLVIDA"
        ? new Date(agora - (demo.respostas?.at(-1)?.diasAtras ?? 1) * DIA_MS)
        : null;

    const reclamacao = await prisma.reclamacao.create({
      data: {
        protocolo,
        titulo: demo.titulo,
        descricao: demo.descricao,
        autorId: autor.id,
        cidadeId: cidade.id,
        categoriaId,
        endereco: demo.endereco,
        cep: "01000-000",
        status: demo.status,
        publicadaEm,
        resolvidaEm,
        createdAt: new Date(publicadaEm.getTime() - 40 * 60_000),
      },
    });

    // Confirmações: quem confirma nunca é o autor (a regra do site).
    const confirmantes = cidadaos.filter((c) => c.id !== autor.id).slice(0, demo.confirmacoes);
    await prisma.confirmacao.createMany({
      data: confirmantes.map((c) => ({ userId: c.id, reclamacaoId: reclamacao.id })),
    });

    for (const [i, texto] of (demo.comentarios ?? []).entries()) {
      await prisma.comentario.create({
        data: {
          reclamacaoId: reclamacao.id,
          autorId: confirmantes[i % Math.max(confirmantes.length, 1)].id,
          texto,
          statusModeracao: "APROVADO",
          // Algumas horas depois da publicação, não "agora": a tela mostra o tempo relativo.
          createdAt: new Date(publicadaEm.getTime() + (i + 1) * 3 * 3_600_000),
        },
      });
    }

    for (const resposta of demo.respostas ?? []) {
      await prisma.respostaOficial.create({
        data: {
          reclamacaoId: reclamacao.id,
          autorId: usuarioOrgao.id,
          orgaoId: orgao.id,
          texto: resposta.texto,
          novoStatus: resposta.novoStatus,
          prazoEstimado: resposta.prazoEmDias
            ? new Date(agora + resposta.prazoEmDias * DIA_MS)
            : undefined,
          createdAt: new Date(agora - resposta.diasAtras * DIA_MS),
        },
      });
    }

    if (demo.avaliacao) {
      await prisma.avaliacao.create({
        data: { reclamacaoId: reclamacao.id, autorId: autor.id, ...demo.avaliacao },
      });
    }
    criadas++;
  }

  console.log(
    `Demo pronta: ${criadas} reclamações novas (${RECLAMACOES.length - criadas} já existiam) em ${cidade.nome}.`
  );
  console.log(`Entre como órgão: ${EMAIL_ORGAO_DEMO} / ${SENHA_DEMO}`);
  console.log(`Cidadãos de demonstração: demo.cidadao1..${CIDADAOS.length}@${DOMINIO} / ${SENHA_DEMO}`);
}

const acao = process.argv.includes("--limpar") ? limpar : criar;

acao()
  .catch((erro) => {
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
