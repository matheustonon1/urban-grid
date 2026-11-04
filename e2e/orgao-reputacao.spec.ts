import { expect, test } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import {
  completarDoisFatoresSeSolicitado,
  criarCidadaoTeste,
  criarOrgaoTeste,
  criarReclamacaoTeste,
  limparDadosTeste,
} from "./helpers";

const DIA = 24 * 60 * 60 * 1000;
const diasAtras = (dias: number) => new Date(Date.now() - dias * DIA);

const idsParaLimpar: string[] = [];

test.afterAll(async () => {
  await prisma.reclamacao.deleteMany({ where: { id: { in: idsParaLimpar } } });
  await limparDadosTeste();
});

// Uma reclamação publicada num dia do passado, com o autor, a cidade e a categoria pedidos.
async function publicadaHa(
  dias: number,
  autorId: string,
  cidadeId: string,
  categoriaId: string
) {
  const reclamacao = await criarReclamacaoTeste(autorId, { cidadeId, categoriaId });
  await prisma.reclamacao.update({
    where: { id: reclamacao.id },
    data: { publicadaEm: diasAtras(dias) },
  });
  idsParaLimpar.push(reclamacao.id);
  return reclamacao;
}

test("o índice conta contra o órgão a reclamação que passou de 15 dias sem resposta, e só ela", async ({
  page,
}) => {
  // Uma cidade sem reclamação de mais ninguém: o número exato não depende do banco compartilhado.
  const cidade = await prisma.cidade.findFirstOrThrow({ where: { reclamacoes: { none: {} } } });
  const outraCidade = await prisma.cidade.findFirstOrThrow({
    where: { id: { not: cidade.id }, reclamacoes: { none: {} } },
  });
  const [categoriaA, categoriaB] = await prisma.categoria.findMany({
    where: { ativa: true },
    orderBy: { ordem: "asc" },
    take: 2,
  });

  const orgao = await criarOrgaoTeste(cidade.id, { categoriaIds: [categoriaA.id] });
  const outroOrgao = await criarOrgaoTeste(cidade.id);
  // O órgão existe há 60 dias: o que foi publicado depois disso (e há mais de 15 dias) conta.
  await prisma.orgao.update({ where: { id: orgao.orgao.id }, data: { createdAt: diasAtras(60) } });

  const { usuario: autor } = await criarCidadaoTeste();

  // Contam: três reclamações da categoria dele, da cidade dele, paradas há 20 dias.
  await publicadaHa(20, autor.id, cidade.id, categoriaA.id);
  await publicadaHa(20, autor.id, cidade.id, categoriaA.id);
  const trocadaDeDono = await publicadaHa(20, autor.id, cidade.id, categoriaA.id);

  // Não contam, cada uma por um motivo:
  await publicadaHa(5, autor.id, cidade.id, categoriaA.id); // ainda dentro do prazo
  await publicadaHa(20, autor.id, cidade.id, categoriaB.id); // categoria que ele não atende
  await publicadaHa(20, autor.id, outraCidade.id, categoriaA.id); // outra cidade
  await publicadaHa(90, autor.id, cidade.id, categoriaA.id); // antes de o órgão existir
  await publicadaHa(20, orgao.usuario.id, cidade.id, categoriaA.id); // aberta pela conta do próprio órgão
  const respondidaPorOutro = await publicadaHa(20, autor.id, cidade.id, categoriaA.id);
  await prisma.respostaOficial.create({
    data: {
      reclamacaoId: respondidaPorOutro.id,
      autorId: outroOrgao.usuario.id,
      orgaoId: outroOrgao.orgao.id,
      texto: "Equipe a caminho.",
      novoStatus: "EM_ANDAMENTO",
    },
  });
  await prisma.reclamacao.update({
    where: { id: respondidaPorOutro.id },
    data: { status: "EM_ANDAMENTO" },
  });

  // Perfil público: 3 paradas além do prazo, nenhuma respondida => índice 0 com base 3 => "Ruim"
  // (antes, sem nenhuma resposta, o selo era "Poucos dados" e o silêncio não custava nada).
  await page.goto(`/orgaos/${orgao.orgao.id}`);
  await expect(page.getByText("3 sem resposta há mais de 15 dias")).toBeVisible();
  await expect(page.getByText("Ruim", { exact: true })).toBeVisible();

  // Transparência: o órgão que nunca respondeu também aparece no ranking, com o número.
  await page.goto("/transparencia");
  const linha = page.getByRole("row", { name: new RegExp(orgao.orgao.nome) });
  await expect(linha).toBeVisible();
  await expect(linha).toContainText("Ruim");
  await expect(linha).toContainText("0%");

  // Se outro órgão responder a uma das três, ela deixa de contar contra este.
  await prisma.respostaOficial.create({
    data: {
      reclamacaoId: trocadaDeDono.id,
      autorId: outroOrgao.usuario.id,
      orgaoId: outroOrgao.orgao.id,
      texto: "Já estamos cuidando.",
      novoStatus: "EM_ANDAMENTO",
    },
  });
  await page.goto(`/orgaos/${orgao.orgao.id}`);
  await expect(page.getByText("2 sem resposta há mais de 15 dias")).toBeVisible();
  // Base 2 (< 3): sem amostra para o selo.
  await expect(page.getByText("Poucos dados ainda")).toBeVisible();

  // O painel do próprio órgão mostra o número e o porquê.
  await page.goto("/login");
  await page.fill('input[name="identificador"]', orgao.email);
  await page.fill('input[name="senha"]', orgao.senha);
  await page.click('button[type="submit"]');
  await completarDoisFatoresSeSolicitado(page, orgao.email);
  await page.waitForURL(/\/orgao$/);
  await expect(page.getByText("Sem resposta há mais de 15 dias")).toBeVisible();
  await expect(
    page.getByText(/passa de 15 dias sem nenhuma resposta conta como não resolvida/)
  ).toBeVisible();
});
