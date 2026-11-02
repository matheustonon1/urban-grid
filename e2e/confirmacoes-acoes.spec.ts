import { expect, test } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import {
  apagarLogsDeModeracao,
  ativarDoisFatoresTeste,
  confirmarDialogo,
  criarAdminTeste,
  criarCidadaoTeste,
  criarReclamacaoTeste,
  emailTeste,
  limparDadosTeste,
} from "./helpers";

// Retorno das ações e confirmação segura: toda ação de moderação/administração
// agora responde com um aviso na tela e as que mudam acesso ou afetam outra
// pessoa passam por um diálogo (com a senha e o código de duas etapas de quem age
// quando muda privilégio).

const idsReclamacaoParaLimpar: string[] = [];

test.afterAll(async () => {
  await apagarLogsDeModeracao({ id: { in: idsReclamacaoParaLimpar } });
  await prisma.reclamacao.deleteMany({ where: { id: { in: idsReclamacaoParaLimpar } } });
  await limparDadosTeste();
});

async function login(page: import("@playwright/test").Page, email: string, senha: string) {
  await page.goto("/login");
  await page.fill('input[name="identificador"]', email);
  await page.fill('input[name="senha"]', senha);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/painel$/);
}

async function abrirLinhaDoUsuario(page: import("@playwright/test").Page, email: string) {
  await page.goto(`/usuarios?q=${encodeURIComponent(email)}`);
  return page.locator("li", { hasText: email });
}

// A denúncia que a tela de moderação lista: criada direto no banco, como nos
// outros specs de moderação, para não depender do formulário público.
async function criarDenunciaAberta(autorId: string, denuncianteId: string) {
  const reclamacao = await criarReclamacaoTeste(autorId, { status: "PUBLICADA" });
  idsReclamacaoParaLimpar.push(reclamacao.id);
  const denuncia = await prisma.denuncia.create({
    data: { alvoTipo: "RECLAMACAO", alvoId: reclamacao.id, denuncianteId, motivo: "SPAM" },
  });
  return { reclamacao, denuncia };
}

function cartaoDaDenuncia(page: import("@playwright/test").Page, protocolo: string) {
  return page.locator("article").filter({ has: page.locator(`a[href$="${protocolo}"]`) });
}

test("papel: senha errada fica no diálogo e não altera; a certa conclui, avisa na tela e a pessoa afetada recebe um aviso", async ({
  page,
}) => {
  const { usuario: admin, email: emailAdmin, senha: senhaAdmin } = await criarAdminTeste();
  const { usuario, email } = await criarCidadaoTeste();

  await login(page, emailAdmin, senhaAdmin);
  const { codigosBackup } = await ativarDoisFatoresTeste(admin.id);
  const linha = await abrirLinhaDoUsuario(page, email);
  await linha.locator('select[name="papel"]').selectOption("MODERADOR");
  await linha.getByRole("button", { name: "Salvar" }).click();

  const dialogo = page.getByRole("dialog");
  await expect(dialogo.getByRole("heading")).toContainText("Alterar o papel de");
  await expect(dialogo).toContainText("passa de Cidadão para Moderador");

  await confirmarDialogo(page, "Alterar para Moderador", "senha-errada-123", codigosBackup[0]);
  await expect(dialogo.getByRole("alert")).toContainText("Senha incorreta");
  await expect(dialogo).toBeVisible();
  const intacto = await prisma.user.findUniqueOrThrow({ where: { id: usuario.id } });
  expect(intacto.papel).toBe("CIDADAO");

  // A senha errada barrou antes do segundo fator: o código de backup não foi gasto.
  await confirmarDialogo(page, "Alterar para Moderador", senhaAdmin, codigosBackup[0]);
  await expect(page.getByText(/Papel de .* alterado para Moderador/)).toBeVisible();
  await expect(dialogo).toBeHidden();

  const promovido = await prisma.user.findUniqueOrThrow({ where: { id: usuario.id } });
  expect(promovido.papel).toBe("MODERADOR");

  const aviso = await prisma.notificacao.findFirst({
    where: { userId: usuario.id, tipo: "CONTA_SEGURANCA" },
  });
  expect(aviso?.titulo).toBe("Seu papel na plataforma mudou");

  // Ficou registrado quem mudou, de qual papel para qual - a senha errada não gerou nada.
  const registros = await prisma.registroAuditoria.findMany({ where: { alvoUserId: usuario.id } });
  expect(registros).toHaveLength(1);
  expect(registros[0]).toMatchObject({
    acao: "PAPEL_ALTERADO",
    atorId: (await prisma.user.findUniqueOrThrow({ where: { email: emailAdmin } })).id,
    detalhes: { de: "CIDADAO", para: "MODERADOR" },
  });
});

test("papel: Cancelar e Esc fecham o diálogo sem alterar nada", async ({ page }) => {
  const { email: emailAdmin, senha: senhaAdmin } = await criarAdminTeste();
  const { usuario, email } = await criarCidadaoTeste();

  await login(page, emailAdmin, senhaAdmin);
  const linha = await abrirLinhaDoUsuario(page, email);
  await linha.locator('select[name="papel"]').selectOption("ADMIN");

  const dialogo = page.getByRole("dialog");
  await linha.getByRole("button", { name: "Salvar" }).click();
  await expect(dialogo).toBeVisible();
  await dialogo.getByRole("button", { name: "Cancelar" }).click();
  await expect(dialogo).toBeHidden();

  await linha.getByRole("button", { name: "Salvar" }).click();
  await expect(dialogo).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialogo).toBeHidden();

  const depois = await prisma.user.findUniqueOrThrow({ where: { id: usuario.id } });
  expect(depois.papel).toBe("CIDADAO");
});

test("papel: sem mudança não há diálogo e a tela diz que nada foi alterado", async ({ page }) => {
  const { email: emailAdmin, senha: senhaAdmin } = await criarAdminTeste();
  const { email } = await criarCidadaoTeste();

  await login(page, emailAdmin, senhaAdmin);
  const linha = await abrirLinhaDoUsuario(page, email);
  await linha.getByRole("button", { name: "Salvar" }).click();

  await expect(page.getByText(/já é Cidadão\. Nada foi alterado\./)).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("banir: 7 dias não pede senha; permanente pede senha e código, e a senha errada não bane", async ({
  page,
}) => {
  const { usuario: autor } = await criarCidadaoTeste();
  const { usuario: denunciante } = await criarCidadaoTeste();
  const { usuario: admin, email, senha } = await criarAdminTeste();
  const { reclamacao, denuncia } = await criarDenunciaAberta(autor.id, denunciante.id);

  await login(page, email, senha);
  const { codigosBackup } = await ativarDoisFatoresTeste(admin.id);
  await page.goto("/denuncias");
  const cartao = cartaoDaDenuncia(page, reclamacao.protocolo);
  const dialogo = page.getByRole("dialog");

  await cartao.locator('select[name="duracao"]').selectOption("7");
  await cartao.getByRole("button", { name: "Banir autor" }).click();
  await expect(dialogo).toContainText("Banir a conta de");
  await expect(dialogo.locator('input[name="senhaConfirmacao"]')).toHaveCount(0);
  await dialogo.getByRole("button", { name: "Cancelar" }).click();
  await expect(dialogo).toBeHidden();

  await cartao.locator('select[name="duracao"]').selectOption("permanente");
  await cartao.getByRole("button", { name: "Banir autor" }).click();
  await expect(dialogo.locator('input[name="senhaConfirmacao"]')).toBeVisible();
  await expect(dialogo.locator('input[name="codigoConfirmacao"]')).toBeVisible();

  await confirmarDialogo(page, "Banir conta", "senha-errada-123", codigosBackup[0]);
  await expect(dialogo.getByRole("alert")).toContainText("Senha incorreta");
  const aindaLivre = await prisma.user.findUniqueOrThrow({ where: { id: autor.id } });
  expect(aindaLivre.banidoAte).toBeNull();
  const aindaAberta = await prisma.denuncia.findUniqueOrThrow({ where: { id: denuncia.id } });
  expect(aindaAberta.status).toBe("ABERTA");

  await confirmarDialogo(page, "Banir conta", senha, codigosBackup[0]);
  await expect(page.getByText(/banida permanentemente/)).toBeVisible();

  const banido = await prisma.user.findUniqueOrThrow({ where: { id: autor.id } });
  expect(banido.banidoAte!.getTime()).toBeGreaterThan(Date.now() + 50 * 365 * 24 * 3600 * 1000);
  const fechada = await prisma.denuncia.findUniqueOrThrow({ where: { id: denuncia.id } });
  expect(fechada.status).toBe("PROCEDENTE");

  const registro = await prisma.registroAuditoria.findFirstOrThrow({
    where: { alvoUserId: autor.id },
  });
  expect(registro.acao).toBe("BANIMENTO_APLICADO");
  expect(registro.detalhes).toMatchObject({ duracao: "permanente", denunciaId: denuncia.id });
});

test("banir: o servidor recusa banir um administrador e a denúncia continua aberta", async ({
  page,
}) => {
  const { usuario: autorAdmin } = await criarAdminTeste({ email: emailTeste("admin-autor") });
  const { usuario: denunciante } = await criarCidadaoTeste();
  const { email, senha } = await criarAdminTeste();
  const { reclamacao, denuncia } = await criarDenunciaAberta(autorAdmin.id, denunciante.id);

  await login(page, email, senha);
  await page.goto("/denuncias");
  const cartao = cartaoDaDenuncia(page, reclamacao.protocolo);

  await cartao.getByRole("button", { name: "Banir autor" }).click();
  await confirmarDialogo(page, "Banir conta");
  await expect(
    page.getByText("Contas de administrador não podem ser banidas por aqui.")
  ).toBeVisible();

  const intacto = await prisma.user.findUniqueOrThrow({ where: { id: autorAdmin.id } });
  expect(intacto.banidoAte).toBeNull();
  const aberta = await prisma.denuncia.findUniqueOrThrow({ where: { id: denuncia.id } });
  expect(aberta.status).toBe("ABERTA");
});

test("moderação: aprovar mostra o retorno e a reclamação sai da fila", async ({ page }) => {
  const { usuario: autor } = await criarCidadaoTeste();
  const { email, senha } = await criarAdminTeste();
  const reclamacao = await criarReclamacaoTeste(autor.id, { status: "AGUARDANDO_REVISAO" });
  idsReclamacaoParaLimpar.push(reclamacao.id);

  await login(page, email, senha);
  await page.goto("/moderacao");
  const cartao = page.locator("article").filter({ hasText: reclamacao.protocolo });
  await cartao.getByRole("button", { name: "Aprovar", exact: true }).click();

  await expect(page.getByText("Reclamação publicada. O autor foi avisado.")).toBeVisible();
  await expect(page.locator("article").filter({ hasText: reclamacao.protocolo })).toHaveCount(0);
});

test("denunciar: quem denuncia recebe a confirmação de que a denúncia foi enviada", async ({
  page,
}) => {
  const { usuario: autor } = await criarCidadaoTeste();
  const { email, senha } = await criarCidadaoTeste();
  const reclamacao = await criarReclamacaoTeste(autor.id, { status: "PUBLICADA" });
  idsReclamacaoParaLimpar.push(reclamacao.id);

  await login(page, email, senha);
  await page.goto(`/reclamacoes/${reclamacao.protocolo}`);
  await page.click('summary:has-text("Denunciar")');
  await page.selectOption('select[name="motivo"]', "SPAM");
  await page.check('input[name="declaracaoVeracidade"]');
  await page.click('button:has-text("Enviar denúncia")');

  await expect(page.getByText("Denúncia enviada. A moderação vai analisar o caso.")).toBeVisible();
});

test("auditoria: o admin vê quem mudou o papel; quem só modera é mandado de volta", async ({
  page,
}) => {
  const { usuario: admin, email: emailAdmin, senha: senhaAdmin } = await criarAdminTeste();
  const { usuario, email } = await criarCidadaoTeste();

  await login(page, emailAdmin, senhaAdmin);
  const { codigosBackup } = await ativarDoisFatoresTeste(admin.id);
  const linha = await abrirLinhaDoUsuario(page, email);
  await linha.locator('select[name="papel"]').selectOption("MODERADOR");
  await linha.getByRole("button", { name: "Salvar" }).click();
  await confirmarDialogo(page, "Alterar para Moderador", senhaAdmin, codigosBackup[0]);
  await expect(page.getByText(/Papel de .* alterado para Moderador/)).toBeVisible();

  await page.goto("/auditoria");
  const registro = page.locator("li").filter({ hasText: "Papel alterado" }).first();
  await expect(registro).toContainText("Cidadão → Moderador");
  await expect(registro).toContainText("Admin E2E");

  // O recém-promovido é moderador, não admin: a tela de auditoria não é dele. Sai da
  // página antes de limpar os cookies: num build de produção os <Link> pré-buscam
  // rotas e a resposta de um prefetch em voo reemite o cookie depois do clearCookies.
  await page.goto("about:blank");
  await page.context().clearCookies();
  await login(page, email, "SenhaForte123");
  await page.goto("/auditoria");
  await expect(page).toHaveURL(/\/painel$/);
  expect(usuario.id).toBeTruthy();
});

