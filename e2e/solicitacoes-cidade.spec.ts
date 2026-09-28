import { expect, test } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import { criarAdminTeste, emailTeste, limparDadosTeste } from "./helpers";

const cidadesCriadas: string[] = [];

test.afterAll(async () => {
  if (cidadesCriadas.length > 0) {
    await prisma.cidade.deleteMany({ where: { id: { in: cidadesCriadas } } });
  }
  await limparDadosTeste();
});

async function login(page: import("@playwright/test").Page, email: string, senha: string) {
  await page.goto("/login");
  await page.fill('input[name="identificador"]', email);
  await page.fill('input[name="senha"]', senha);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/painel$/);
}

test("solicitar cidade nova, aprovar como admin e criar a Cidade de verdade", async ({
  page,
}) => {
  const { email: emailAdmin, senha } = await criarAdminTeste();
  const sufixo = Date.now();
  const nomeCidade = `Cidade E2E ${sufixo}`;
  const email = emailTeste("solicitante-cidade");
  // Faixa que não colide com código IBGE real (nenhum município começa
  // com 9999) - só precisa satisfazer o formato de 7 dígitos.
  const codigoIbge = `9999${String(sufixo).slice(-3)}`;

  await page.goto("/cidades/solicitar");
  await page.fill('input[name="nomeCidade"]', nomeCidade);
  await page.selectOption('select[name="uf"]', "SP");
  await page.fill('input[name="nomeSolicitante"]', "Solicitante E2E");
  await page.fill('input[name="email"]', email);
  await page.click('button[type="submit"]');
  await expect(page.getByText("Solicitação enviada!")).toBeVisible();

  const solicitacao = await prisma.solicitacaoCidade.findFirstOrThrow({
    where: { nomeCidade, email },
  });
  expect(solicitacao.status).toBe("PENDENTE");

  await login(page, emailAdmin, senha);
  await page.goto("/solicitacoes-cidade");

  const cartao = page.locator(`text=${nomeCidade} - SP`).locator("..");
  await cartao.locator('input[name="codigoIbge"]').fill(codigoIbge);
  await cartao.getByRole("button", { name: "Aprovar e criar cidade" }).click();
  await page.waitForTimeout(1000);

  const solicitacaoFinal = await prisma.solicitacaoCidade.findUniqueOrThrow({
    where: { id: solicitacao.id },
  });
  expect(solicitacaoFinal.status).toBe("APROVADA");

  const cidadeCriada = await prisma.cidade.findUnique({ where: { codigoIbge } });
  expect(cidadeCriada).not.toBeNull();
  expect(cidadeCriada!.nome).toBe(nomeCidade);
  expect(cidadeCriada!.slug).toBe(`cidade-e2e-${sufixo}-sp`);
  if (cidadeCriada) {
    cidadesCriadas.push(cidadeCriada.id);
  }
});

test("rejeitar solicitação de cidade não cria a Cidade e registra o motivo", async ({ page }) => {
  const { email: emailAdmin, senha } = await criarAdminTeste();
  const sufixo = Date.now();
  const nomeCidade = `Cidade E2E Rejeitada ${sufixo}`;
  const email = emailTeste("solicitante-cidade-rejeitada");

  await page.goto("/cidades/solicitar");
  await page.fill('input[name="nomeCidade"]', nomeCidade);
  await page.selectOption('select[name="uf"]', "RJ");
  await page.fill('input[name="nomeSolicitante"]', "Solicitante E2E");
  await page.fill('input[name="email"]', email);
  await page.click('button[type="submit"]');
  await expect(page.getByText("Solicitação enviada!")).toBeVisible();

  await login(page, emailAdmin, senha);
  await page.goto("/solicitacoes-cidade");

  const cartao = page.locator(`text=${nomeCidade} - RJ`).locator("..");
  await cartao.locator('textarea[name="motivo"]').fill("Município fora da área de cobertura piloto.");
  await cartao.getByRole("button", { name: "Rejeitar" }).click();
  await page.waitForTimeout(1000);

  const solicitacao = await prisma.solicitacaoCidade.findFirstOrThrow({
    where: { nomeCidade, email },
  });
  expect(solicitacao.status).toBe("REJEITADA");
  expect(solicitacao.motivoRejeicao).toContain("cobertura piloto");

  const cidadeCriada = await prisma.cidade.findFirst({ where: { nome: nomeCidade } });
  expect(cidadeCriada).toBeNull();
});
