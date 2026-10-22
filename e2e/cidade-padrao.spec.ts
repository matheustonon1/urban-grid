import { expect, test, type Page } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import { aguardarHidratacao, criarCidadaoTeste, limparDadosTeste } from "./helpers";

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

// Valor que o formulário da página realmente enviaria. Escopado ao <main>
// porque o cabeçalho também tem um seletor de cidade (busca) com o mesmo name.
function cidadeEnviada(page: Page) {
  return page.getByRole("main").locator('input[type="hidden"][name="cidadeId"]');
}

async function duasCidades() {
  const cidades = await prisma.cidade.findMany({
    take: 2,
    orderBy: { nome: "asc" },
    select: { id: true, nome: true, estado: { select: { uf: true } } },
  });
  expect(cidades).toHaveLength(2);
  return cidades.map((c) => ({ id: c.id, nome: c.nome, uf: c.estado.uf, rotulo: `${c.nome} - ${c.estado.uf}` }));
}

// Digita no combobox e escolhe a opção exata da lista ("Nome - UF").
async function escolherCidade(page: Page, campo: ReturnType<Page["locator"]>, cidade: { nome: string; rotulo: string }) {
  await campo.fill(cidade.nome);
  await page.getByRole("option", { name: cidade.rotulo, exact: true }).click();
  await expect(campo).toHaveValue(cidade.rotulo);
}

test("a cidade padrão da conta já vem escolhida em 'Nova reclamação' e pode ser removida", async ({
  page,
}) => {
  const [cidadeA] = await duasCidades();
  const { usuario, email, senha } = await criarCidadaoTeste();
  await login(page, email, senha);

  await page.goto("/painel/conta");
  const perfil = page.locator("form:has(#perfil-cidade)");
  await escolherCidade(page, page.locator("#perfil-cidade"), cidadeA);
  await perfil.getByRole("button", { name: "Salvar dados" }).click();
  await expect(perfil.getByText("Dados atualizados.")).toBeVisible();
  expect((await prisma.user.findUniqueOrThrow({ where: { id: usuario.id } })).cidadeId).toBe(cidadeA.id);

  // Persistiu de verdade: a tela de conta recarrega com ela, e a nova
  // reclamação já abre com a cidade escolhida (campo visível + valor enviado).
  await page.reload();
  await expect(page.locator("#perfil-cidade")).toHaveValue(cidadeA.rotulo);

  await page.goto("/reclamacoes/nova");
  const cidadeNova = page.locator('input[aria-label="Cidade"]');
  await expect(cidadeNova).toHaveValue(cidadeA.rotulo);
  await expect(cidadeEnviada(page)).toHaveValue(cidadeA.id);

  // Apagar o campo remove a cidade padrão.
  await page.goto("/painel/conta");
  await page.locator("#perfil-cidade").fill("");
  await perfil.getByRole("button", { name: "Salvar dados" }).click();
  await expect(perfil.getByText("Dados atualizados.")).toBeVisible();
  expect((await prisma.user.findUniqueOrThrow({ where: { id: usuario.id } })).cidadeId).toBeNull();

  await page.goto("/reclamacoes/nova");
  await expect(page.locator('input[aria-label="Cidade"]')).toHaveValue("");
});

test("o CEP sempre vence a cidade padrão, mesmo se for a mesma e a pessoa já tiver trocado na mão", async ({
  page,
}) => {
  const [cidadeA, cidadeB] = await duasCidades();
  const { usuario, email, senha } = await criarCidadaoTeste();
  await prisma.user.update({ where: { id: usuario.id }, data: { cidadeId: cidadeA.id } });
  await login(page, email, senha);

  // ViaCEP é serviço externo (e /api/cep tem limite por IP) - o que importa
  // aqui é o que a tela faz com a resposta, então responde direto.
  await page.route("**/api/cep?**", (rota) =>
    rota.fulfill({
      json: {
        logradouro: "Rua de Teste E2E",
        bairro: "Centro",
        cidade: { id: cidadeA.id, nome: cidadeA.nome, uf: cidadeA.uf },
      },
    })
  );

  await page.goto("/reclamacoes/nova");
  const campoCidade = page.locator('input[aria-label="Cidade"]');
  await expect(campoCidade).toHaveValue(cidadeA.rotulo);

  // A pessoa troca pra outra cidade na mão...
  await escolherCidade(page, campoCidade, cidadeB);
  await expect(cidadeEnviada(page)).toHaveValue(cidadeB.id);

  // ...e depois digita um CEP que é da cidade padrão: o CEP manda.
  await page.fill('input[name="cep"]', "69900000");
  await expect(page.locator('input[aria-label="Cidade"]')).toHaveValue(cidadeA.rotulo);
  await expect(cidadeEnviada(page)).toHaveValue(cidadeA.id);
});

test("não grava uma cidade padrão que não existe", async ({ page }) => {
  const { usuario, email, senha } = await criarCidadaoTeste();
  await login(page, email, senha);

  await page.goto("/painel/conta");
  const perfil = page.locator("form:has(#perfil-cidade)");
  // Sem esperar a hidratação, o React reescreve o campo escondido (de volta pra
  // vazio) depois de forjado, e o envio passa como "sem cidade padrão".
  await aguardarHidratacao(page, 'form:has(#perfil-cidade) input[type="hidden"][name="cidadeId"]');
  // Simula um POST forjado: o campo escondido com um id que não é de cidade nenhuma.
  await perfil
    .locator('input[type="hidden"][name="cidadeId"]')
    .evaluate((el, valor) => ((el as HTMLInputElement).value = valor), "id-que-nao-existe");
  await perfil.getByRole("button", { name: "Salvar dados" }).click();

  await expect(perfil.getByText("Escolha uma cidade da lista.")).toBeVisible();
  expect((await prisma.user.findUniqueOrThrow({ where: { id: usuario.id } })).cidadeId).toBeNull();
});
