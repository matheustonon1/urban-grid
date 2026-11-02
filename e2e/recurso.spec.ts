import { expect, test } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import {
  criarAdminTeste,
  criarCidadaoTeste,
  criarReclamacaoTeste,
  limparDadosTeste,
  sairDaSessao,
} from "./helpers";

test.afterAll(async () => {
  await limparDadosTeste();
});

test("recurso contra rejeição aprovado publica a reclamação", async ({ page }) => {
  const { usuario: autor, email, senha } = await criarCidadaoTeste();
  const { email: emailAdmin, senha: senhaAdmin } = await criarAdminTeste();
  const reclamacao = await criarReclamacaoTeste(autor.id, {
    status: "REJEITADA",
    motivoRejeicao: "Rejeitada pela IA no teste E2E.",
  });

  await page.goto("/login");
  await page.fill('input[name="identificador"]', email);
  await page.fill('input[name="senha"]', senha);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/painel$/);

  await page.goto(`/reclamacoes/${reclamacao.protocolo}`);
  await expect(page.getByText("Contestar rejeição")).toBeVisible();
  const formRecurso = page.locator('form:has(button:has-text("Contestar rejeição"))');
  await formRecurso
    .locator('textarea[name="texto"]')
    .fill("Discordo da rejeição, o problema relatado é real e está dentro do escopo municipal.");
  await formRecurso.locator('button:has-text("Contestar rejeição")').click();
  await expect(
    page.getByText("Seu recurso contra a rejeição está em análise por um moderador.")
  ).toBeVisible();

  await sairDaSessao(page);
  await page.goto("/login");
  await page.fill('input[name="identificador"]', emailAdmin);
  await page.fill('input[name="senha"]', senhaAdmin);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/painel$/);

  await page.goto("/moderacao");
  await expect(page.getByText("Recurso do cidadão contra rejeição")).toBeVisible();
  await page.click('button:has-text("Aprovar")');
  await expect(page.getByText(reclamacao.titulo)).toHaveCount(0);

  const reclamacaoFinal = await prisma.reclamacao.findUniqueOrThrow({
    where: { id: reclamacao.id },
  });
  expect(reclamacaoFinal.status).toBe("PUBLICADA");
});

test("recurso contra rejeição negado bloqueia um segundo recurso", async ({ page }) => {
  const { usuario: autor, email, senha } = await criarCidadaoTeste();
  const { email: emailAdmin, senha: senhaAdmin } = await criarAdminTeste();
  const reclamacao = await criarReclamacaoTeste(autor.id, {
    status: "REJEITADA",
    motivoRejeicao: "Rejeitada pela IA no teste E2E (caso negado).",
  });

  await page.goto("/login");
  await page.fill('input[name="identificador"]', email);
  await page.fill('input[name="senha"]', senha);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/painel$/);

  await page.goto(`/reclamacoes/${reclamacao.protocolo}`);
  const formRecurso = page.locator('form:has(button:has-text("Contestar rejeição"))');
  await formRecurso
    .locator('textarea[name="texto"]')
    .fill("Não concordo com a rejeição desta reclamação.");
  await formRecurso.locator('button:has-text("Contestar rejeição")').click();

  await sairDaSessao(page);
  await page.goto("/login");
  await page.fill('input[name="identificador"]', emailAdmin);
  await page.fill('input[name="senha"]', senhaAdmin);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/painel$/);

  await page.goto("/moderacao");
  await expect(page.getByText("Recurso do cidadão contra rejeição")).toBeVisible();
  await page.fill('textarea[name="motivo"]', "Revisado novamente, rejeição mantida no teste E2E.");
  await page.click('button:has-text("Rejeitar")');
  await expect(page.getByText(reclamacao.titulo)).toHaveCount(0);

  await sairDaSessao(page);
  await page.goto("/login");
  await page.fill('input[name="identificador"]', email);
  await page.fill('input[name="senha"]', senha);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/painel$/);

  await page.goto(`/reclamacoes/${reclamacao.protocolo}`);
  await expect(page.getByText("Você já contestou esta decisão")).toBeVisible();
  await expect(
    page.locator('form:has(button:has-text("Contestar rejeição"))')
  ).toHaveCount(0);
});
