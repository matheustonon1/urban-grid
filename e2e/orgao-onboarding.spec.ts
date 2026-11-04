import { expect, test } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import {
  ativarDoisFatoresTeste,
  confirmarDialogo,
  criarAdminTeste,
  emailTeste,
  limparDadosTeste,
  sairDaSessao,
} from "./helpers";

test.afterAll(async () => {
  await limparDadosTeste();
});

// CNPJs de exemplo com dígitos verificadores corretos (não precisam existir na Receita). O
// alfanumérico é o exemplo oficial da Receita; o teste do cartão usa um próprio para não
// somar com o órgão que o teste de aprovação deixa criado com o outro.
const CNPJ_VALIDO_COM_MASCARA = "11.222.333/0001-81";
const CNPJ_ALFANUMERICO = "12ABC34501DE35";

test("solicita acesso como órgão, admin aprova, define senha e loga", async ({ page }) => {
  const { usuario: admin, email: emailAdmin, senha: senhaAdmin } = await criarAdminTeste();
  const emailOrgao = emailTeste("solicitacao-orgao");
  const cidade = await prisma.cidade.findFirstOrThrow();

  const nomeOrgao = `Secretaria E2E ${Date.now()}`;

  await page.goto("/cadastro?tipo=orgao");
  await page.fill('input[name="nomeOrgao"]', nomeOrgao);
  const cidadeInput = page.locator('main input[placeholder^="Cidade"]');
  await cidadeInput.fill(cidade.nome.slice(0, 5));
  await page.locator('main button[role="option"]').first().click();
  await page.fill('input[name="nomeResponsavel"]', "Responsável E2E");
  await page.fill('input[name="email"]', emailOrgao);
  // CNPJ com máscara e site sem o "https://": o servidor guarda os dois normalizados.
  await page.fill('input[name="cnpj"]', CNPJ_VALIDO_COM_MASCARA);
  await page.fill('input[name="linkOficial"]', "Prefeitura-E2E.exemplo.gov.br/");
  await page.check('input[name="aceitaTermos"]');
  await page.click('button:has-text("Enviar solicitação")');
  await expect(page.getByRole("heading", { name: "Solicitação enviada!" })).toBeVisible();

  await page.goto("/login");
  await page.fill('input[name="identificador"]', emailAdmin);
  await page.fill('input[name="senha"]', senhaAdmin);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/painel$/);

  // Aprovar concede voz oficial: pede a senha e o código de duas etapas do admin.
  const { codigosBackup } = await ativarDoisFatoresTeste(admin.id);
  await page.goto("/solicitacoes-orgao");
  await expect(page.getByText(emailOrgao)).toBeVisible();
  // O cartão mostra o que foi informado, com o CNPJ mascarado e o site padronizado, e o site
  // .gov.br vira um sinal positivo.
  await expect(page.getByText(CNPJ_VALIDO_COM_MASCARA)).toBeVisible();
  await expect(
    page.getByRole("link", { name: "https://prefeitura-e2e.exemplo.gov.br" })
  ).toBeVisible();
  await expect(page.getByText("Site institucional (prefeitura-e2e.exemplo.gov.br)")).toBeVisible();
  await page.click('button:has-text("Aprovar")');
  await confirmarDialogo(page, "Aprovar e enviar acesso", senhaAdmin, codigosBackup[0]);

  await expect
    .poll(async () => {
      const solicitacao = await prisma.solicitacaoOrgao.findFirstOrThrow({
        where: { email: emailOrgao },
      });
      return solicitacao.status;
    })
    .toBe("APROVADA");

  // O órgão criado herda o CNPJ e o site do pedido, já normalizados.
  const orgaoCriado = await prisma.orgao.findFirstOrThrow({ where: { nome: nomeOrgao } });
  expect(orgaoCriado.cnpj).toBe("11222333000181");
  expect(orgaoCriado.linkOficial).toBe("https://prefeitura-e2e.exemplo.gov.br");

  // O e-mail de acesso pode falhar de enviar de verdade (endereço de
  // teste sem domínio verificado no Resend) - o token já foi criado
  // antes da tentativa de envio, então buscamos ele direto no banco,
  // como um teste automatizado tem que fazer (não há inbox pra ler).
  // Com poll: a solicitação vira APROVADA numa transação e o token só é
  // criado depois, ao montar o e-mail - ler logo ao ver APROVADA era uma
  // corrida.
  let token = "";
  await expect
    .poll(async () => {
      const registro = await prisma.verificationToken.findFirst({
        where: { identifier: emailOrgao },
        orderBy: { expires: "desc" },
      });
      token = registro?.token ?? "";
      return token;
    })
    .not.toBe("");

  await sairDaSessao(page);
  await page.goto(`/orgao/definir-senha/${token}`);
  await expect(page.getByText("Bem-vindo(a)")).toBeVisible();

  const senha = "SenhaForte123";
  await page.fill('input[name="senha"]', senha);
  await page.fill('input[name="confirmarSenha"]', senha);
  await page.click('button[type="submit"]');
  // Conta de órgão nova ainda não tem o segundo fator, e sem ele o painel não abre: o convite
  // já leva a Minha conta, na seção de segurança, onde ele é ativado.
  await page.waitForURL(/\/painel\/conta/);
  await expect(
    page.getByText("A autenticação em duas etapas é obrigatória para contas de órgão.")
  ).toBeVisible();

  const usuarioOrgao = await prisma.user.findUniqueOrThrow({ where: { email: emailOrgao } });
  expect(usuarioOrgao.papel).toBe("ORGAO");
  expect(usuarioOrgao.senhaHash).not.toBeNull();
});

test("o formulário recusa CNPJ com dígito errado e site que não é endereço web, sem criar pedido", async ({
  page,
}) => {
  const emailOrgao = emailTeste("solicitacao-invalida");
  const cidade = await prisma.cidade.findFirstOrThrow();

  await page.goto("/cadastro?tipo=orgao");
  await page.fill('input[name="nomeOrgao"]', `Secretaria E2E Invalida ${Date.now()}`);
  await page.locator('main input[placeholder^="Cidade"]').fill(cidade.nome.slice(0, 5));
  await page.locator('main button[role="option"]').first().click();
  await page.fill('input[name="nomeResponsavel"]', "Responsável E2E");
  await page.fill('input[name="email"]', emailOrgao);
  await page.fill('input[name="cnpj"]', "11.222.333/0001-82");
  await page.fill('input[name="linkOficial"]', "javascript:alert(1)");
  await page.check('input[name="aceitaTermos"]');
  await page.click('button:has-text("Enviar solicitação")');

  await expect(page.getByText("Informe um CNPJ válido, com os 14 caracteres.")).toBeVisible();
  await expect(page.getByText(/Informe o endereço de um site/)).toBeVisible();
  expect(await prisma.solicitacaoOrgao.count({ where: { email: emailOrgao } })).toBe(0);
});

test("o cartão do admin mostra CNPJ e site, sinaliza CNPJ repetido, e a consulta responde sem travar a decisão", async ({
  page,
}) => {
  const { email: emailAdmin, senha: senhaAdmin } = await criarAdminTeste();
  const cidade = await prisma.cidade.findFirstOrThrow();
  const sufixo = Date.now();
  const nomeOrgao = `Secretaria E2E Cnpj ${sufixo}`;
  const emailOrgao = emailTeste("solicitacao-cnpj");

  // Um órgão que já usa o mesmo CNPJ (uma secretaria com o CNPJ da prefeitura, por exemplo).
  await prisma.orgao.create({
    data: { nome: `Órgão E2E Cnpj ${sufixo}`, cidadeId: cidade.id, cnpj: CNPJ_ALFANUMERICO },
  });
  // Pedido pela mesma via do formulário, mas direto no banco: o site fica no mesmo domínio
  // do e-mail (example.com), o que vira o sinal "mesmo domínio".
  await prisma.solicitacaoOrgao.create({
    data: {
      nomeOrgao,
      cidadeId: cidade.id,
      nomeResponsavel: "Responsável E2E",
      email: emailOrgao,
      cnpj: CNPJ_ALFANUMERICO,
      linkOficial: "https://www.example.com",
    },
  });

  await page.goto("/login");
  await page.fill('input[name="identificador"]', emailAdmin);
  await page.fill('input[name="senha"]', senhaAdmin);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/painel$/);

  await page.goto("/solicitacoes-orgao");
  const cartao = page.locator("article", { hasText: nomeOrgao });
  await expect(cartao.getByText("12.ABC.345/01DE-35")).toBeVisible();
  await expect(cartao.getByRole("link", { name: "https://www.example.com" })).toBeVisible();
  await expect(cartao.getByText("Site no mesmo domínio do e-mail")).toBeVisible();
  await expect(cartao.getByText("CNPJ também cadastrado em 1 outro órgão")).toBeVisible();

  // A consulta chama um serviço público externo. Em ambiente sem rede ou com o CNPJ de exemplo
  // fora da base ela falha, e isso é parte do contrato: a tela responde, e a decisão segue livre.
  await cartao.getByRole("button", { name: "Consultar CNPJ na Receita" }).click();
  await expect(
    cartao.getByText(/CNPJ não encontrado|Não foi possível consultar agora|Situação:/)
  ).toBeVisible({ timeout: 20_000 });
  await expect(cartao.getByRole("button", { name: "Aprovar" })).toBeEnabled();
});
