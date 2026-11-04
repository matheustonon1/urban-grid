import { expect, test } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import { criarCidadaoTeste, criarOrgaoTeste, criarReclamacaoTeste, limparDadosTeste, completarDoisFatoresSeSolicitado } from "./helpers";

test.afterAll(async () => {
  await limparDadosTeste();
});

test("órgão restrito a uma categoria só vê e responde reclamações dela", async ({ page }) => {
  const cidade = await prisma.cidade.findFirstOrThrow();
  const categorias = await prisma.categoria.findMany({
    where: { ativa: true },
    orderBy: { ordem: "asc" },
    take: 2,
  });
  const [categoriaAtendida, categoriaNaoAtendida] = categorias;

  const { email: emailOrgao, senha: senhaOrgao } = await criarOrgaoTeste(cidade.id, {
    categoriaIds: [categoriaAtendida.id],
  });
  const { usuario: autor } = await criarCidadaoTeste();

  const reclamacaoAtendida = await criarReclamacaoTeste(autor.id, {
    cidadeId: cidade.id,
    categoriaId: categoriaAtendida.id,
  });
  const reclamacaoNaoAtendida = await criarReclamacaoTeste(autor.id, {
    cidadeId: cidade.id,
    categoriaId: categoriaNaoAtendida.id,
  });

  await page.goto("/login");
  await page.fill('input[name="identificador"]', emailOrgao);
  await page.fill('input[name="senha"]', senhaOrgao);
  await page.click('button[type="submit"]');
  await completarDoisFatoresSeSolicitado(page, emailOrgao);
  await page.waitForURL(/\/(painel|orgao)$/);

  await page.goto("/orgao");
  const textoPainel = await page.locator("main").innerText();
  expect(textoPainel).toContain(reclamacaoAtendida.titulo);
  expect(textoPainel.includes(reclamacaoNaoAtendida.protocolo)).toBe(false);

  await page.goto(`/reclamacoes/${reclamacaoAtendida.protocolo}`);
  await expect(page.getByText("Responder como órgão")).toBeVisible();

  await page.goto(`/reclamacoes/${reclamacaoNaoAtendida.protocolo}`);
  await expect(page.getByText("Responder como órgão")).toHaveCount(0);
});
