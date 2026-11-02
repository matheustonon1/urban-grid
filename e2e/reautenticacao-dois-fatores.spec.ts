import { expect, test, type Page } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import {
  ativarDoisFatoresTeste,
  confirmarDialogo,
  criarAdminTeste,
  criarCidadaoTeste,
  gerarCodigoTotpAtual,
  limparDadosTeste,
} from "./helpers";

// Ações que mudam acesso (aqui, mudar o papel de uma conta) pedem senha E código de duas
// etapas de quem age. O diálogo é só a tela: quem decide é o servidor, e é isso que estes
// testes comprovam - inclusive com a tela adulterada.

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

// Abre o diálogo de "Alterar para Moderador" da conta `email`, que é o ponto mais simples
// para exercitar a reautenticação (a de banir e a de aprovar órgão usam a mesma função).
async function abrirDialogoDePapel(page: Page, email: string) {
  await page.goto(`/usuarios?q=${encodeURIComponent(email)}`);
  const linha = page.locator("li", { hasText: email });
  await linha.locator('select[name="papel"]').selectOption("MODERADOR");
  await linha.getByRole("button", { name: "Salvar" }).click();
  await page.getByRole("dialog").waitFor();
}

async function papelDe(userId: string) {
  return (await prisma.user.findUniqueOrThrow({ where: { id: userId } })).papel;
}

test("sem 2FA o diálogo manda ativar e não deixa confirmar", async ({ page }) => {
  const { email: emailAdmin, senha } = await criarAdminTeste();
  const { usuario, email } = await criarCidadaoTeste();

  await login(page, emailAdmin, senha);
  await abrirDialogoDePapel(page, email);

  const dialogo = page.getByRole("dialog");
  await expect(dialogo.getByText("Ative a verificação em duas etapas")).toBeVisible();
  await expect(dialogo.getByRole("link", { name: "Ativar em Minha conta" })).toHaveAttribute(
    "href",
    "/painel/conta"
  );
  await expect(dialogo.getByRole("button", { name: "Alterar para Moderador" })).toBeDisabled();
  await expect(dialogo.locator('input[name="senhaConfirmacao"]')).toHaveCount(0);
  await expect(dialogo.locator('input[name="codigoConfirmacao"]')).toHaveCount(0);
  expect(await papelDe(usuario.id)).toBe("CIDADAO");
});

test("sem 2FA o servidor recusa mesmo com a tela adulterada e a senha certa", async ({ page }) => {
  const { email: emailAdmin, senha } = await criarAdminTeste();
  const { usuario, email } = await criarCidadaoTeste();

  await login(page, emailAdmin, senha);
  await abrirDialogoDePapel(page, email);

  // Destrava o botão e injeta os campos que a tela não mostra: o servidor não pode
  // confiar no que o navegador exibiu.
  await page.evaluate((senhaDoAdmin) => {
    const dialogo = document.querySelector("dialog[open]")!;
    for (const [nome, valor] of [
      ["senhaConfirmacao", senhaDoAdmin],
      ["codigoConfirmacao", "123456"],
    ]) {
      const campo = document.createElement("input");
      campo.type = "hidden";
      campo.name = nome;
      campo.value = valor;
      dialogo.appendChild(campo);
    }
    dialogo.querySelector<HTMLButtonElement>('button[data-confirmacao="sim"]')!.disabled = false;
  }, senha);
  await page.getByRole("dialog").getByRole("button", { name: "Alterar para Moderador" }).click();

  await expect(page.getByText(/Esta ação exige a verificação em duas etapas/)).toBeVisible();
  expect(await papelDe(usuario.id)).toBe("CIDADAO");
});

test("código do aplicativo: o errado não altera, o certo conclui e não vale uma segunda vez", async ({
  page,
}) => {
  const { usuario: admin, email: emailAdmin, senha } = await criarAdminTeste();
  const { usuario: primeiro, email: emailPrimeiro } = await criarCidadaoTeste();
  const { usuario: segundo, email: emailSegundo } = await criarCidadaoTeste();

  await login(page, emailAdmin, senha);
  const { segredoCifrado } = await ativarDoisFatoresTeste(admin.id);

  await abrirDialogoDePapel(page, emailPrimeiro);
  const dialogo = page.getByRole("dialog");
  await expect(dialogo.locator('input[name="codigoConfirmacao"]')).toBeVisible();

  await confirmarDialogo(page, "Alterar para Moderador", senha, "000000");
  await expect(dialogo.getByRole("alert")).toContainText("Código incorreto");
  expect(await papelDe(primeiro.id)).toBe("CIDADAO");

  const codigo = await gerarCodigoTotpAtual(segredoCifrado);
  await confirmarDialogo(page, "Alterar para Moderador", senha, codigo);
  await expect(page.getByText(/Papel de .* alterado para Moderador/)).toBeVisible();
  expect(await papelDe(primeiro.id)).toBe("MODERADOR");

  // O mesmo código, ainda dentro do passo de 30 s, é replay: não promove a outra conta.
  await abrirDialogoDePapel(page, emailSegundo);
  await confirmarDialogo(page, "Alterar para Moderador", senha, codigo);
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Esse código já foi usado"
  );
  expect(await papelDe(segundo.id)).toBe("CIDADAO");
});

test("código de backup vale uma vez só", async ({ page }) => {
  const { usuario: admin, email: emailAdmin, senha } = await criarAdminTeste();
  const { usuario: primeiro, email: emailPrimeiro } = await criarCidadaoTeste();
  const { usuario: segundo, email: emailSegundo } = await criarCidadaoTeste();

  await login(page, emailAdmin, senha);
  const { codigosBackup } = await ativarDoisFatoresTeste(admin.id);

  await abrirDialogoDePapel(page, emailPrimeiro);
  await confirmarDialogo(page, "Alterar para Moderador", senha, codigosBackup[0]);
  await expect(page.getByText(/Papel de .* alterado para Moderador/)).toBeVisible();
  expect(await papelDe(primeiro.id)).toBe("MODERADOR");

  await abrirDialogoDePapel(page, emailSegundo);
  await confirmarDialogo(page, "Alterar para Moderador", senha, codigosBackup[0]);
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("Código incorreto");
  expect(await papelDe(segundo.id)).toBe("CIDADAO");

  // Outro código de backup segue valendo.
  await confirmarDialogo(page, "Alterar para Moderador", senha, codigosBackup[1]);
  await expect(page.getByText(/Papel de .* alterado para Moderador/)).toBeVisible();
  expect(await papelDe(segundo.id)).toBe("MODERADOR");
});

test("cinco códigos errados bloqueiam, e o código certo também é recusado enquanto durar", async ({
  page,
}) => {
  const { usuario: admin, email: emailAdmin, senha } = await criarAdminTeste();
  const { usuario, email } = await criarCidadaoTeste();

  await login(page, emailAdmin, senha);
  const { codigosBackup } = await ativarDoisFatoresTeste(admin.id);

  await abrirDialogoDePapel(page, email);
  const dialogo = page.getByRole("dialog");
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    await confirmarDialogo(page, "Alterar para Moderador", senha, "000000");
    await expect(dialogo.getByRole("alert")).toContainText("Código incorreto");
  }

  await confirmarDialogo(page, "Alterar para Moderador", senha, codigosBackup[0]);
  await expect(dialogo.getByRole("alert")).toContainText("Muitas tentativas incorretas");
  expect(await papelDe(usuario.id)).toBe("CIDADAO");
});
