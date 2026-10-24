import { expect, test, type Page } from "@playwright/test";

import { prisma } from "@/lib/prisma";
import {
  cifrarSegredoTotp,
  consumirCodigoBackup,
  gerarCodigosBackup,
  gerarSegredoTotp,
  prepararCodigosBackup,
  reservarTimeStepTotp,
} from "@/lib/seguranca/totp";

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

test("o mesmo código TOTP, usado ao mesmo tempo, só vale uma vez (e o timeStep nunca regride)", async () => {
  const { usuario } = await criarCidadaoTeste();

  // Dez tentativas simultâneas com o mesmo timeStep - o que um terceiro que
  // viu o código faria. Antes, o login lia o último timeStep, validava e
  // gravava depois: todas leriam o mesmo valor e passariam.
  const resultados = await Promise.all(
    Array.from({ length: 10 }, () => reservarTimeStepTotp(usuario.id, 5000))
  );
  expect(resultados.filter(Boolean)).toHaveLength(1);

  expect(await reservarTimeStepTotp(usuario.id, 5000)).toBe(false); // já usado
  expect(await reservarTimeStepTotp(usuario.id, 4999)).toBe(false); // anterior
  expect(await reservarTimeStepTotp(usuario.id, 5001)).toBe(true); // próximo

  const gravado = await prisma.user.findUniqueOrThrow({ where: { id: usuario.id } });
  expect(gravado.totpUltimoTimeStep).toBe(5001);
});

test("código de backup aceita maiúsculas e espaços, mas só uma vez, e lixo nem chega no banco", async () => {
  const { usuario } = await criarCidadaoTeste();
  const [a, b] = gerarCodigosBackup();
  await prisma.totpBackupCode.createMany({ data: await prepararCodigosBackup(usuario.id, [a, b]) });

  expect(await consumirCodigoBackup(usuario.id, `  ${a.toUpperCase()} `)).toBe(true);
  expect(await consumirCodigoBackup(usuario.id, a)).toBe(false); // já gasto
  // Espaço no meio (colado de uma lista formatada).
  expect(await consumirCodigoBackup(usuario.id, `${b.slice(0, 5)} ${b.slice(5)}`)).toBe(true);

  for (const lixo of ["", "   ", "abc", "zzzzzzzzzz", `${a}${a}`]) {
    expect(await consumirCodigoBackup(usuario.id, lixo)).toBe(false);
  }
});

test("clicar de novo em 'Ativar autenticador' (outra aba) não troca o segredo já mostrado", async ({
  browser,
}) => {
  const { usuario, email, senha } = await criarCidadaoTeste();
  const contexto = await browser.newContext();
  const pagina1 = await contexto.newPage();
  await login(pagina1, email, senha);

  // Duas abas abertas ANTES de qualquer clique: as duas mostram o botão.
  await pagina1.goto("/painel/conta");
  const pagina2 = await contexto.newPage();
  await pagina2.goto("/painel/conta");

  await pagina1.getByRole("button", { name: "Ativar autenticador" }).click();
  await pagina1.waitForSelector("#codigo-totp");
  const primeiro = (await prisma.user.findUniqueOrThrow({ where: { id: usuario.id } })).totpSecret;
  expect(primeiro).not.toBeNull();

  // A aba 2 ainda tem o botão (estado velho). Antes, esse clique gerava um
  // segredo novo por cima do QR que a aba 1 já estava mostrando.
  await pagina2.getByRole("button", { name: "Ativar autenticador" }).click();
  await pagina2.waitForSelector("#codigo-totp");

  const depois = (await prisma.user.findUniqueOrThrow({ where: { id: usuario.id } })).totpSecret;
  expect(depois).toBe(primeiro);

  await contexto.close();
});

test("o botão de copiar os códigos de backup avisa quando a cópia falha", async ({ page }) => {
  const { usuario, email, senha } = await criarCidadaoTeste();
  await login(page, email, senha);
  await prisma.user.update({
    where: { id: usuario.id },
    data: { totpSecret: cifrarSegredoTotp(gerarSegredoTotp()), totpConfirmadoEm: new Date() },
  });

  // Controla o resultado da cópia: o headless nem sempre nega a permissão
  // do jeito que um navegador real faria.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: () =>
          (window as unknown as { __copiaFalha?: boolean }).__copiaFalha
            ? Promise.reject(new Error("negado"))
            : Promise.resolve(),
      },
    });
  });

  await page.goto("/painel/conta");
  const regenerar = page.locator('form:has(button:has-text("Gerar novos códigos"))');
  await regenerar.locator('input[name="senhaAtual"]').fill(senha);
  await regenerar.getByRole("button", { name: "Gerar novos códigos" }).click();
  await page.waitForSelector("ul.grid li");

  await page.getByRole("button", { name: "Copiar" }).click();
  await expect(page.getByRole("button", { name: "Copiado" })).toBeVisible();

  await page.evaluate(() => {
    (window as unknown as { __copiaFalha?: boolean }).__copiaFalha = true;
  });
  await expect(page.getByRole("button", { name: "Copiar" })).toBeVisible({ timeout: 5000 });
  await page.getByRole("button", { name: "Copiar" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Não foi possível copiar" })).toBeVisible();
});
