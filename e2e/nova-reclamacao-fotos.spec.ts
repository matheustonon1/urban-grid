import { expect, test } from "@playwright/test";

import { criarCidadaoTeste, limparDadosTeste } from "./helpers";

test.afterAll(async () => {
  await limparDadosTeste();
});

// PNG 1x1 válido - só precisa passar pela checagem de FileList do
// navegador, nunca chega a ser enviado (o teste não clica em "Enviar
// reclamação") - então não entra na moderação de IA de verdade.
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
);

test("seletor de fotos: adicionar, remover individualmente e ampliar", async ({ page }) => {
  const { email, senha } = await criarCidadaoTeste();

  await page.goto("/login");
  await page.fill('input[name="identificador"]', email);
  await page.fill('input[name="senha"]', senha);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/painel$/);

  await page.goto("/reclamacoes/nova");

  const inputFotos = page.locator('input[id="imagens-input"]');
  await inputFotos.setInputFiles([
    { name: "foto1.png", mimeType: "image/png", buffer: PNG_1X1 },
    { name: "foto2.png", mimeType: "image/png", buffer: PNG_1X1 },
  ]);

  await expect(page.getByText("2 fotos selecionadas")).toBeVisible();
  const miniaturas = page.locator('button:has(img[alt=""])');
  await expect(miniaturas).toHaveCount(2);

  // Remove a primeira - o botão "x" é o segundo <button> dentro do
  // mesmo wrapper da miniatura (primeiro é a própria foto, clicável
  // pra ampliar).
  const primeiraMiniatura = miniaturas.first();
  const wrapperPrimeira = primeiraMiniatura.locator("..");
  await wrapperPrimeira.getByRole("button", { name: "Remover foto" }).click();

  await expect(page.getByText("1 foto selecionada")).toBeVisible();
  await expect(miniaturas).toHaveCount(1);

  // Clica na miniatura restante pra ampliar.
  await miniaturas.first().click();
  await expect(page.getByRole("dialog")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
