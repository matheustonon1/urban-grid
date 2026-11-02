import { expect, test } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import { criarCidadaoTeste, criarReclamacaoTeste, limparDadosTeste } from "./helpers";

test.afterAll(async () => {
  await limparDadosTeste();
});

test("autor avalia reclamação resolvida como realmente resolvida", async ({ page }) => {
  const { usuario, email, senha } = await criarCidadaoTeste();
  const reclamacao = await criarReclamacaoTeste(usuario.id, { status: "PUBLICADA" });
  await prisma.reclamacao.update({
    where: { id: reclamacao.id },
    data: { status: "RESOLVIDA", resolvidaEm: new Date() },
  });

  await page.goto("/login");
  await page.fill('input[name="identificador"]', email);
  await page.fill('input[name="senha"]', senha);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/painel$/);

  await page.goto(`/reclamacoes/${reclamacao.protocolo}`);
  await expect(page.getByText("O problema foi realmente resolvido?")).toBeVisible();
  await page.selectOption('select[name="nota"]', "5");
  await page.check('input[name="resolvido"][value="true"]');
  await page.click('button:has-text("Enviar avaliação")');

  await expect(page.getByText("O problema foi realmente resolvido?")).toHaveCount(0);

  const avaliacao = await prisma.avaliacao.findUniqueOrThrow({
    where: { reclamacaoId: reclamacao.id },
  });
  expect(avaliacao.nota).toBe(5);
  expect(avaliacao.resolvido).toBe(true);
});

test("autor avalia reclamação resolvida como não resolvida de fato", async ({ page }) => {
  const { usuario, email, senha } = await criarCidadaoTeste();
  const reclamacao = await criarReclamacaoTeste(usuario.id, { status: "PUBLICADA" });
  await prisma.reclamacao.update({
    where: { id: reclamacao.id },
    data: { status: "RESOLVIDA", resolvidaEm: new Date() },
  });

  await page.goto("/login");
  await page.fill('input[name="identificador"]', email);
  await page.fill('input[name="senha"]', senha);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/painel$/);

  await page.goto(`/reclamacoes/${reclamacao.protocolo}`);
  await page.selectOption('select[name="nota"]', "1");
  await page.check('input[name="resolvido"][value="false"]');
  await page.click('button:has-text("Enviar avaliação")');
  await expect(page.getByText("O problema foi realmente resolvido?")).toHaveCount(0);

  const avaliacao = await prisma.avaliacao.findUniqueOrThrow({
    where: { reclamacaoId: reclamacao.id },
  });
  expect(avaliacao.resolvido).toBe(false);

  // Contestar reabre a reclamação (reabertura-avaliacao.spec.ts cobre o resto do ciclo): ela
  // volta para Em andamento, então não há mais o que avaliar até o órgão resolver de novo.
  const reaberta = await prisma.reclamacao.findUniqueOrThrow({ where: { id: reclamacao.id } });
  expect(reaberta.status).toBe("EM_ANDAMENTO");
  expect(reaberta.resolvidaEm).toBeNull();

  await page.reload();
  await expect(page.getByText("O problema foi realmente resolvido?")).toHaveCount(0);
});
