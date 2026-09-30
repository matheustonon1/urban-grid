import { expect, test } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import { criarCidadaoTeste, limparDadosTeste } from "./helpers";

test.afterAll(async () => {
  await limparDadosTeste();
});

test("desligar notificações por e-mail em 'Minha conta' persiste a preferência", async ({
  page,
}) => {
  const { usuario, email, senha } = await criarCidadaoTeste();
  expect(usuario.notificarPorEmail).toBe(true);

  await page.goto("/login");
  await page.fill('input[name="identificador"]', email);
  await page.fill('input[name="senha"]', senha);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/painel$/);

  await page.goto("/painel/conta");
  // Escopado ao <form> que tem o checkbox, não a página inteira - "Salvar
  // dados" também é o texto do botão de FormularioPerfil, logo acima.
  const formulario = page.locator('form:has(input[name="notificarPorEmail"])');
  const checkbox = formulario.locator('input[name="notificarPorEmail"]');
  await expect(checkbox).toBeChecked();

  await checkbox.uncheck();
  await formulario.getByRole("button", { name: "Salvar dados" }).click();
  await page.waitForTimeout(500);

  const usuarioAtualizado = await prisma.user.findUniqueOrThrow({ where: { id: usuario.id } });
  expect(usuarioAtualizado.notificarPorEmail).toBe(false);

  // Recarrega e confirma que o estado persistido volta desmarcado (não só
  // que o banco mudou, mas que a tela reflete isso de verdade).
  await page.reload();
  await expect(page.locator('input[name="notificarPorEmail"]')).not.toBeChecked();
});
