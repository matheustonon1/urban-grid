import { expect, test } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import { criarCidadaoTeste, criarOrgaoNoRanking, limparDadosTeste } from "./helpers";

// 375px = largura de telas pequenas comuns (iPhone SE/12/13 mini) - o
// cabeçalho já transbordou 40px nessa largura por causa da quantidade de
// itens no nav (ver commit que introduziu este teste). Cobre logado e
// deslogado porque os itens do nav mudam entre os dois estados.
test.use({ viewport: { width: 375, height: 800 } });

test.afterAll(async () => {
  await limparDadosTeste();
});

async function semEstouroHorizontal(page: import("@playwright/test").Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

test("cabeçalho não estoura a largura da tela em 375px, deslogado", async ({ page }) => {
  await page.goto("/");
  await semEstouroHorizontal(page);

  await page.goto("/login");
  await semEstouroHorizontal(page);
});

// O nome longo de um órgão no ranking da home (linha com `truncate`) alargava a coluna
// do grid e a página inteira rolava de lado no celular - e só aparece com um órgão no
// ranking, que o banco vazio dos outros testes não tem.
test("ranking de órgãos com nome longo não estoura a largura em 375px", async ({ page }) => {
  const cidade = await prisma.cidade.findFirstOrThrow();
  await criarOrgaoNoRanking(cidade.id);

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Órgãos mais bem avaliados" })).toBeVisible();
  await semEstouroHorizontal(page);
});

// A tabela do ranking em /transparencia não cabe em 375px: ela rola dentro do próprio contêiner
// (a página não), e a coluna do órgão fica fixa para que as notas não percam o dono ao rolar.
test("ranking de /transparencia rola de lado e mantém o órgão à vista em 375px", async ({ page }) => {
  const cidade = await prisma.cidade.findFirstOrThrow();
  await criarOrgaoNoRanking(cidade.id);

  await page.goto("/transparencia");
  await expect(page.getByRole("heading", { name: "Ranking de órgãos" })).toBeVisible();
  await semEstouroHorizontal(page);

  const rolagem = page.locator("main .rolagem-x").first();
  const colunaOrgao = rolagem.locator("tbody th[scope=row]").first();
  const antes = await colunaOrgao.boundingBox();
  expect(antes).not.toBeNull();

  const escondido = await rolagem.evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(escondido).toBeGreaterThan(0);

  await rolagem.evaluate((el) => {
    el.scrollLeft = el.scrollWidth;
  });
  const depois = await colunaOrgao.boundingBox();
  expect(Math.abs(depois!.x - antes!.x)).toBeLessThanOrEqual(1);

  // Rolado até o fim, a última coluna (Nota) cabe dentro do contêiner.
  const caixa = await rolagem.boundingBox();
  const nota = await rolagem.getByRole("columnheader", { name: "Nota" }).boundingBox();
  expect(nota!.x + nota!.width).toBeLessThanOrEqual(caixa!.x + caixa!.width + 1);

  await semEstouroHorizontal(page);
});

test("cabeçalho não estoura a largura da tela em 375px, logado", async ({ page }) => {
  const { email, senha } = await criarCidadaoTeste();

  await page.goto("/login");
  await page.fill('input[name="identificador"]', email);
  await page.fill('input[name="senha"]', senha);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/painel$/);

  await semEstouroHorizontal(page);
});
