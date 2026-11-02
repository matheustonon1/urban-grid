import { expect, test, type Page } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import {
  apagarLogsDeModeracao,
  criarCidadaoTeste,
  criarOrgaoTeste,
  criarReclamacaoTeste,
  limparDadosTeste,
} from "./helpers";

// Quem abre uma reclamação e quem responde oficialmente não podem ser a mesma parte: um órgão
// que registra, responde, marca como resolvida e se avalia infla a própria reputação pública.

const idsReclamacaoParaLimpar: string[] = [];

test.afterAll(async () => {
  await apagarLogsDeModeracao({ id: { in: idsReclamacaoParaLimpar } });
  await prisma.reclamacao.deleteMany({ where: { id: { in: idsReclamacaoParaLimpar } } });
  await limparDadosTeste();
});

async function login(page: Page, email: string, senha: string) {
  await page.goto("/login");
  await page.fill('input[name="identificador"]', email);
  await page.fill('input[name="senha"]', senha);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(painel|orgao)$/);
}

test("conta de órgão não registra reclamação: a página explica e leva ao painel do órgão", async ({
  page,
}) => {
  const cidade = await prisma.cidade.findFirstOrThrow();
  const { email, senha } = await criarOrgaoTeste(cidade.id);

  await login(page, email, senha);
  await page.goto("/reclamacoes/nova");

  await expect(page.getByText("Contas de órgão não registram reclamações")).toBeVisible();
  // Sem o formulário: não há o que preencher.
  await expect(page.locator('textarea[name="descricao"]')).toHaveCount(0);

  await page.getByRole("link", { name: "Ir para o painel do órgão" }).click();
  await expect(page).toHaveURL(/\/orgao$/);
});

test("o servidor recusa a resposta de um órgão a uma reclamação aberta por conta do próprio órgão", async ({
  page,
}) => {
  const cidade = await prisma.cidade.findFirstOrThrow();
  const { usuario: autor } = await criarCidadaoTeste();
  const { orgao, email, senha } = await criarOrgaoTeste(cidade.id);
  const reclamacao = await criarReclamacaoTeste(autor.id, { cidadeId: cidade.id });
  idsReclamacaoParaLimpar.push(reclamacao.id);

  await login(page, email, senha);
  await page.goto(`/reclamacoes/${reclamacao.protocolo}`);
  await expect(page.getByText("Responder como órgão")).toBeVisible();
  await page.fill('textarea[name="texto"]', "Resposta que o servidor não pode aceitar.");

  // Com a tela já aberta (formulário visível), a reclamação passa a ser de uma conta do
  // órgão: só o servidor pode barrar, a tela não sabia.
  const colega = await prisma.user.create({
    data: {
      name: "Colega do órgão E2E",
      email: `e2e-teste-colega-${Date.now()}@example.com`,
      papel: "ORGAO",
      orgaoId: orgao.id,
      emailVerified: new Date(),
      termosAceitosEm: new Date(),
    },
  });
  await prisma.reclamacao.update({ where: { id: reclamacao.id }, data: { autorId: colega.id } });

  await page.click('button:has-text("Enviar resposta")');
  await expect(
    page.getByText("Esta reclamação foi aberta por uma conta do seu órgão, então ele não pode respondê-la.")
  ).toBeVisible();

  expect(await prisma.respostaOficial.count({ where: { reclamacaoId: reclamacao.id } })).toBe(0);
});

test("a tela do órgão não oferece responder à reclamação aberta por conta dele", async ({ page }) => {
  const cidade = await prisma.cidade.findFirstOrThrow();
  const { orgao, email, senha } = await criarOrgaoTeste(cidade.id);
  const colega = await prisma.user.create({
    data: {
      name: "Colega do órgão E2E",
      email: `e2e-teste-colega-${Date.now()}@example.com`,
      papel: "ORGAO",
      orgaoId: orgao.id,
      emailVerified: new Date(),
      termosAceitosEm: new Date(),
    },
  });
  const reclamacao = await criarReclamacaoTeste(colega.id, { cidadeId: cidade.id });
  idsReclamacaoParaLimpar.push(reclamacao.id);

  await login(page, email, senha);
  await page.goto(`/reclamacoes/${reclamacao.protocolo}`);
  await expect(page.getByRole("heading", { name: reclamacao.titulo })).toBeVisible();
  await expect(page.getByText("Responder como órgão")).toHaveCount(0);
});
