import { expect, test } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import { criarCidadaoTeste, criarReclamacaoTeste, limparDadosTeste } from "./helpers";

test.afterAll(async () => {
  await limparDadosTeste();
});

test('"também sofro com isso" alterna confirmação e o contador reflete isso', async ({ page }) => {
  const { usuario: autor } = await criarCidadaoTeste();
  const { usuario, email, senha } = await criarCidadaoTeste();
  const reclamacao = await criarReclamacaoTeste(autor.id, { status: "PUBLICADA" });

  await page.goto("/login");
  await page.fill('input[name="identificador"]', email);
  await page.fill('input[name="senha"]', senha);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/painel$/);

  await page.goto(`/reclamacoes/${reclamacao.protocolo}`);
  await expect(page.getByText("Nenhuma pessoa confirmou este problema.")).toBeVisible();

  const botao = page.getByRole("button", { name: "Também sofro com isso" });
  await expect(botao).toHaveAttribute("aria-pressed", "false");
  await botao.click();
  await expect(page.getByText("1 pessoa confirmou este problema.")).toBeVisible();
  await expect(botao).toHaveAttribute("aria-pressed", "true");

  const confirmacao = await prisma.confirmacao.findUnique({
    where: { userId_reclamacaoId: { userId: usuario.id, reclamacaoId: reclamacao.id } },
  });
  expect(confirmacao).not.toBeNull();

  await botao.click();
  await expect(page.getByText("Nenhuma pessoa confirmou este problema.")).toBeVisible();
  await expect(botao).toHaveAttribute("aria-pressed", "false");

  const confirmacaoRemovida = await prisma.confirmacao.findUnique({
    where: { userId_reclamacaoId: { userId: usuario.id, reclamacaoId: reclamacao.id } },
  });
  expect(confirmacaoRemovida).toBeNull();
});

test("autor não vê o botão de confirmar na própria reclamação", async ({ page }) => {
  const { usuario, email, senha } = await criarCidadaoTeste();
  const reclamacao = await criarReclamacaoTeste(usuario.id, { status: "PUBLICADA" });

  await page.goto("/login");
  await page.fill('input[name="identificador"]', email);
  await page.fill('input[name="senha"]', senha);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/painel$/);

  await page.goto(`/reclamacoes/${reclamacao.protocolo}`);
  await expect(page.getByText("Também sofro com isso")).toHaveCount(0);
});
