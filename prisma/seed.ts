// ---------------------------------------------------------------------------
// Seed do banco: estados e municípios (API do IBGE), categorias e admin.
// Idempotente — usa upsert/skipDuplicates, pode rodar quantas vezes quiser.
//
// Geografia: vem da API do IBGE; se ela falhar (ou com SEED_IBGE=local, que é o que o CI usa),
// vem do arquivo prisma/dados/ibge-localidades.json, um retrato dos mesmos dados (regerado por
// `npx tsx prisma/gerar-snapshot-ibge.ts`). A API do IBGE dá timeout de conexão nos runners do
// GitHub Actions, então o CI não pode depender dela.
// ---------------------------------------------------------------------------

import fs from "fs";
import path from "path";

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const IBGE_BASE = "https://servicodados.ibge.gov.br/api/v1/localidades";
const LOTE = 500;

interface EstadoIbge {
  id: number;
  sigla: string;
  nome: string;
}

interface MunicipioIbge {
  id: number;
  nome: string;
}

function slugify(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function emLotes<T>(itens: T[], tamanho: number): T[][] {
  const lotes: T[][] = [];
  for (let i = 0; i < itens.length; i += tamanho) {
    lotes.push(itens.slice(i, i + tamanho));
  }
  return lotes;
}

async function buscarJson<T>(url: string): Promise<T> {
  const resposta = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!resposta.ok) {
    throw new Error(`Falha ao buscar ${url}: ${resposta.status}`);
  }
  return resposta.json() as Promise<T>;
}

type EstadoComMunicipios = EstadoIbge & { municipios: MunicipioIbge[] };

async function baixarLocalidades(): Promise<EstadoComMunicipios[]> {
  const estados = await buscarJson<EstadoIbge[]>(`${IBGE_BASE}/estados?orderBy=nome`);
  const completos: EstadoComMunicipios[] = [];
  for (const estado of estados) {
    const municipios = await buscarJson<MunicipioIbge[]>(
      `${IBGE_BASE}/estados/${estado.sigla}/municipios?orderBy=nome`
    );
    completos.push({ ...estado, municipios });
  }
  return completos;
}

function lerLocalidadesDoArquivo(): EstadoComMunicipios[] {
  const arquivo = path.join(process.cwd(), "prisma", "dados", "ibge-localidades.json");
  return JSON.parse(fs.readFileSync(arquivo, "utf8")).estados as EstadoComMunicipios[];
}

async function carregarLocalidades(): Promise<EstadoComMunicipios[]> {
  if (process.env.SEED_IBGE === "local") {
    console.log("Geografia: usando prisma/dados/ibge-localidades.json (SEED_IBGE=local).");
    return lerLocalidadesDoArquivo();
  }
  try {
    return await baixarLocalidades();
  } catch (erro) {
    console.warn(
      "API do IBGE indisponível; usando prisma/dados/ibge-localidades.json:",
      erro instanceof Error ? erro.message : erro
    );
    return lerLocalidadesDoArquivo();
  }
}

async function seedGeografia() {
  const estados = await carregarLocalidades();

  const estadoIdPorUf = new Map<string, string>();

  for (const estado of estados) {
    const registro = await prisma.estado.upsert({
      where: { uf: estado.sigla },
      update: { nome: estado.nome },
      create: { nome: estado.nome, uf: estado.sigla },
    });
    estadoIdPorUf.set(estado.sigla, registro.id);
  }

  console.log(`Estados: ${estados.length} carregados.`);

  let totalCidades = 0;

  for (const estado of estados) {
    const municipios = estado.municipios;

    const estadoId = estadoIdPorUf.get(estado.sigla);
    if (!estadoId) continue;

    const dados = municipios.map((municipio) => ({
      nome: municipio.nome,
      slug: `${slugify(municipio.nome)}-${estado.sigla.toLowerCase()}`,
      codigoIbge: String(municipio.id),
      estadoId,
    }));

    for (const lote of emLotes(dados, LOTE)) {
      await prisma.cidade.createMany({ data: lote, skipDuplicates: true });
    }

    totalCidades += municipios.length;
  }

  console.log(`Cidades: ${totalCidades} carregadas.`);
}

const CATEGORIAS = [
  { nome: "Iluminação pública", icone: "lightbulb" },
  { nome: "Buracos e pavimentação", icone: "road" },
  { nome: "Coleta de lixo", icone: "trash-2" },
  { nome: "Saneamento e esgoto", icone: "droplet" },
  { nome: "Sinalização de trânsito", icone: "traffic-cone" },
  { nome: "Praças e áreas verdes", icone: "trees" },
  { nome: "Poluição sonora", icone: "volume-2" },
  { nome: "Poluição e queimadas", icone: "cloud" },
  { nome: "Transporte público", icone: "bus" },
  { nome: "Obras irregulares", icone: "hard-hat" },
  { nome: "Animais e zoonoses", icone: "dog" },
  { nome: "Segurança pública", icone: "shield" },
  { nome: "Acessibilidade", icone: "accessibility" },
  { nome: "Saúde pública", icone: "heart-pulse" },
  { nome: "Outros", icone: "more-horizontal" },
] as const;

async function seedCategorias() {
  for (const [ordem, categoria] of CATEGORIAS.entries()) {
    await prisma.categoria.upsert({
      where: { nome: categoria.nome },
      update: { icone: categoria.icone, ordem },
      create: {
        nome: categoria.nome,
        slug: slugify(categoria.nome),
        icone: categoria.icone,
        ordem,
      },
    });
  }

  console.log(`Categorias: ${CATEGORIAS.length} carregadas.`);
}

async function seedAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@urbangrid.local";
  const senha = process.env.SEED_ADMIN_SENHA ?? "admin123";
  const senhaHash = await bcrypt.hash(senha, 10);

  await prisma.user.upsert({
    where: { email },
    update: { senhaHash, papel: "ADMIN" },
    create: {
      email,
      name: "Administrador",
      senhaHash,
      papel: "ADMIN",
      nivelVerificacao: "EMAIL",
    },
  });

  console.log(`Admin: ${email} pronto.`);
}

async function seedOrgaoDemo() {
  const CODIGO_IBGE_DEMO = "3550308"; // São Paulo - SP
  const NOME_ORGAO = "Secretaria de Serviços Urbanos (demo)";

  const cidade = await prisma.cidade.findUnique({
    where: { codigoIbge: CODIGO_IBGE_DEMO },
  });
  if (!cidade) {
    console.warn(
      "seedOrgaoDemo: cidade de demonstração não encontrada — rode seedGeografia antes. Pulando."
    );
    return;
  }

  const orgao = await prisma.orgao.upsert({
    where: { cidadeId_nome: { cidadeId: cidade.id, nome: NOME_ORGAO } },
    update: {},
    create: { nome: NOME_ORGAO, sigla: "SSU", cidadeId: cidade.id },
  });

  const email = process.env.SEED_ORGAO_EMAIL ?? "orgao@urbangrid.local";
  const senha = process.env.SEED_ORGAO_SENHA ?? "orgao123";
  const senhaHash = await bcrypt.hash(senha, 10);

  await prisma.user.upsert({
    where: { email },
    update: { senhaHash, papel: "ORGAO", orgaoId: orgao.id },
    create: {
      email,
      name: `Representante (demo) - ${NOME_ORGAO}`,
      senhaHash,
      papel: "ORGAO",
      orgaoId: orgao.id,
      nivelVerificacao: "EMAIL",
    },
  });

  console.log(`Órgão demo: ${NOME_ORGAO} (${cidade.nome}) e usuário ${email} prontos.`);
}

async function main() {
  await seedGeografia();
  await seedCategorias();
  await seedAdmin();
  await seedOrgaoDemo();
}

main()
  .catch((erro) => {
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
