import { expect, test, type Page } from "@playwright/test";

import { criarCidadaoTeste, limparDadosTeste } from "./helpers";

test.afterAll(async () => {
  await limparDadosTeste();
});

async function login(page: Page, email: string, senha: string) {
  await page.goto("/login");
  await page.fill('input[name="identificador"]', email);
  await page.fill('input[name="senha"]', senha);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/painel$/);
}

// O aviso de "reenviar e-mail de verificação" (painel) é um aviso flutuante de sucesso; o 4º pedido em
// 10 minutos vira um de erro. Os dois lados da regra da barra de tempo saem do mesmo botão.
const BOTAO = "Reenviar e-mail de verificação";

test("o aviso que some sozinho mostra a barra de tempo, que congela com o mouse em cima", async ({
  page,
}) => {
  const { email, senha } = await criarCidadaoTeste({ emailVerificado: false });
  await login(page, email, senha);
  await page.clock.install();

  await page.getByRole("button", { name: BOTAO }).click();
  const aviso = page.getByRole("status").getByText(`Enviamos um novo link de verificação para ${email}.`);
  const barra = page.getByRole("status").getByTestId("barra-aviso");
  await expect(aviso).toBeVisible();
  await expect(barra).toBeVisible();
  await expect(barra).toHaveCSS("animation-play-state", "running");
  await expect(barra).toHaveCSS("animation-duration", "7s");

  // Mouse em cima: a barra congela e o aviso não sai, por mais que o tempo passe.
  await aviso.hover();
  await expect(barra).toHaveCSS("animation-play-state", "paused");
  await page.clock.runFor(30_000);
  await expect(aviso).toBeVisible();

  // Mouse fora: volta a correr e o aviso sai ao fim do tempo que faltava.
  await page.mouse.move(0, 0);
  await expect(barra).toHaveCSS("animation-play-state", "running");
  await page.clock.runFor(7_100);
  await expect(aviso).toBeHidden();
});

test("o aviso de erro fica até ser fechado e por isso não tem barra", async ({ page }) => {
  const { email, senha } = await criarCidadaoTeste({ emailVerificado: false });
  await login(page, email, senha);

  const botao = page.getByRole("button", { name: BOTAO });
  const sucesso = page.getByRole("status").getByText("Enviamos um novo link de verificação").first();
  for (let i = 0; i < 3; i++) {
    await botao.click();
    await expect(sucesso).toBeVisible();
  }

  await botao.click();
  const erro = page.getByRole("alert").getByText("Você pediu muitos e-mails em pouco tempo");
  await expect(erro).toBeVisible();
  await expect(page.getByRole("alert").getByTestId("barra-aviso")).toHaveCount(0);
});
