import { expect, test } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import {
  confirmarDialogo,
  criarAdminTeste,
  criarCidadaoTeste,
  criarReclamacaoTeste,
  limparDadosTeste,
} from "./helpers";

test.afterAll(async () => {
  await limparDadosTeste();
});

async function login(page: import("@playwright/test").Page, email: string, senha: string) {
  await page.goto("/login");
  await page.fill('input[name="identificador"]', email);
  await page.fill('input[name="senha"]', senha);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/painel$/);
}

test("denúncia procedente arquiva a reclamação e notifica o autor", async ({ page }) => {
  const { usuario: autor } = await criarCidadaoTeste();
  const { email: emailDenunciante, senha: senhaDenunciante } = await criarCidadaoTeste();
  const { email: emailAdmin, senha: senhaAdmin } = await criarAdminTeste();
  const reclamacao = await criarReclamacaoTeste(autor.id, { status: "PUBLICADA" });

  await login(page, emailDenunciante, senhaDenunciante);
  await page.goto(`/reclamacoes/${reclamacao.protocolo}`);
  await page.click("summary:has-text(\"Denunciar\")");
  await page.selectOption('select[name="motivo"]', "OFENSIVO");
  await page.fill('textarea[name="descricao"]', "Conteúdo ofensivo de teste E2E.");
  await page.check('input[name="declaracaoVeracidade"]');
  await page.click('button:has-text("Enviar denúncia")');

  // Depois de denunciar, a própria seção "Denunciar" some pra esse usuário
  // nesta reclamação (uma denúncia aberta por vez).
  await expect(page.locator("summary:has-text(\"Denunciar\")")).toHaveCount(0);

  await page.context().clearCookies();
  await login(page, emailAdmin, senhaAdmin);
  await page.goto("/denuncias");
  await expect(page.getByText(reclamacao.titulo)).toBeVisible();
  await page.click('button:has-text("Procedente (arquivar reclamação)")');
  await confirmarDialogo(page, "Arquivar reclamação");
  await expect(page.getByText(reclamacao.titulo)).toHaveCount(0);

  const denunciaFinal = await prisma.denuncia.findFirstOrThrow({
    where: { alvoId: reclamacao.id },
  });
  expect(denunciaFinal.status).toBe("PROCEDENTE");

  const reclamacaoFinal = await prisma.reclamacao.findUniqueOrThrow({
    where: { id: reclamacao.id },
  });
  expect(reclamacaoFinal.status).toBe("ARQUIVADA");

  const notificacao = await prisma.notificacao.findFirstOrThrow({
    where: { userId: autor.id, reclamacaoId: reclamacao.id, tipo: "MUDANCA_STATUS" },
  });
  expect(notificacao.titulo).toBe("Reclamação arquivada");
});

test("denúncia improcedente mantém a reclamação publicada", async ({ page }) => {
  const { usuario: autor } = await criarCidadaoTeste();
  const { email: emailDenunciante, senha: senhaDenunciante } = await criarCidadaoTeste();
  const { email: emailAdmin, senha: senhaAdmin } = await criarAdminTeste();
  const reclamacao = await criarReclamacaoTeste(autor.id, { status: "PUBLICADA" });

  await login(page, emailDenunciante, senhaDenunciante);
  await page.goto(`/reclamacoes/${reclamacao.protocolo}`);
  await page.click("summary:has-text(\"Denunciar\")");
  await page.selectOption('select[name="motivo"]', "OUTRO");
  await page.check('input[name="declaracaoVeracidade"]');
  await page.click('button:has-text("Enviar denúncia")');

  await page.context().clearCookies();
  await login(page, emailAdmin, senhaAdmin);
  await page.goto("/denuncias");
  await page.click('button:has-text("Improcedente")');
  await expect(page.getByText(reclamacao.titulo)).toHaveCount(0);

  const reclamacaoFinal = await prisma.reclamacao.findUniqueOrThrow({
    where: { id: reclamacao.id },
  });
  expect(reclamacaoFinal.status).toBe("PUBLICADA");
});

test("admin bane o autor denunciado e o login passa a ser bloqueado", async ({ page }) => {
  const { usuario: autor, email: emailAutor, senha: senhaAutor } = await criarCidadaoTeste();
  const { email: emailDenunciante, senha: senhaDenunciante } = await criarCidadaoTeste();
  const { email: emailAdmin, senha: senhaAdmin } = await criarAdminTeste();
  const reclamacao = await criarReclamacaoTeste(autor.id, { status: "PUBLICADA" });

  await login(page, emailDenunciante, senhaDenunciante);
  await page.goto(`/reclamacoes/${reclamacao.protocolo}`);
  await page.click("summary:has-text(\"Denunciar\")");
  await page.selectOption('select[name="motivo"]', "OFENSIVO");
  await page.check('input[name="declaracaoVeracidade"]');
  await page.click('button:has-text("Enviar denúncia")');

  await page.context().clearCookies();
  await login(page, emailAdmin, senhaAdmin);
  await page.goto("/denuncias");
  await page.selectOption('select[name="duracao"]', "30");
  await page.click('button:has-text("Banir autor")');
  await confirmarDialogo(page, "Banir conta");

  await expect.poll(async () => {
    const usuario = await prisma.user.findUniqueOrThrow({ where: { id: autor.id } });
    return usuario.banidoAte !== null;
  }).toBe(true);

  await page.context().clearCookies();
  await page.goto("/login");
  await page.fill('input[name="identificador"]', emailAutor);
  await page.fill('input[name="senha"]', senhaAutor);
  await page.click('button[type="submit"]');
  await expect(page.getByText("Esta conta está suspensa.")).toBeVisible();
});
