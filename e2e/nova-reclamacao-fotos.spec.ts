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

test("avisa na hora, sem precisar enviar o formulário, quando o arquivo estoura o limite ou tem formato inválido", async ({
  page,
}) => {
  const { email, senha } = await criarCidadaoTeste();

  await page.goto("/login");
  await page.fill('input[name="identificador"]', email);
  await page.fill('input[name="senha"]', senha);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/painel$/);

  await page.goto("/reclamacoes/nova");
  const inputFotos = page.locator('input[id="imagens-input"]');

  // Maior que MAX_TAMANHO_BYTES (5MB) - não precisa ser um PNG de
  // verdade, a checagem do cliente só olha o .size do File.
  const arquivoGrande = Buffer.alloc(6 * 1024 * 1024);
  await inputFotos.setInputFiles([{ name: "foto-grande.png", mimeType: "image/png", buffer: arquivoGrande }]);
  await expect(page.getByText(/foto-grande\.png tem 6\.0MB — o limite é 5MB por foto\./)).toBeVisible();
  // Arquivo inválido não entra na lista - nenhuma miniatura.
  await expect(page.locator('button:has(img[alt=""])')).toHaveCount(0);

  await inputFotos.setInputFiles([{ name: "documento.gif", mimeType: "image/gif", buffer: PNG_1X1 }]);
  await expect(
    page.getByText("documento.gif: formato não aceito (use JPEG, PNG ou WebP).")
  ).toBeVisible();
  await expect(page.locator('button:has(img[alt=""])')).toHaveCount(0);

  // Uma seleção válida depois limpa o aviso.
  await inputFotos.setInputFiles([{ name: "foto-ok.png", mimeType: "image/png", buffer: PNG_1X1 }]);
  await expect(page.getByText(/formato não aceito|o limite é 5MB/)).toHaveCount(0);
  await expect(page.locator('button:has(img[alt=""])')).toHaveCount(1);
});
