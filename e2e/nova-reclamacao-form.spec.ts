import { expect, test, type Page } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import { criarCidadaoTeste, limparDadosTeste } from "./helpers";

test.afterAll(async () => {
  await limparDadosTeste();
});

// PNG 1x1 válido: o cliente só confere tipo e tamanho, não decodifica.
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64"
);
const foto = (nome: string) => ({ name: nome, mimeType: "image/png", buffer: PNG_1X1 });

async function abrirFormulario(page: Page) {
  const { email, senha } = await criarCidadaoTeste();
  await page.goto("/login");
  await page.fill('input[name="identificador"]', email);
  await page.fill('input[name="senha"]', senha);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/painel$/);
  await page.goto("/reclamacoes/nova");
}

// ViaCEP é serviço externo (e /api/cep tem limite por IP): responde direto.
async function simularCep(page: Page) {
  const cidade = await prisma.cidade.findFirstOrThrow({
    select: { id: true, nome: true, estado: { select: { uf: true } } },
  });
  await page.route("**/api/cep?**", (rota) =>
    rota.fulfill({
      json: {
        logradouro: "Rua de Teste E2E",
        bairro: "Centro",
        cidade: { id: cidade.id, nome: cidade.nome, uf: cidade.estado.uf },
      },
    })
  );
}

test("um erro de validação não apaga o que a pessoa escreveu nem desmarca a declaração", async ({
  page,
}) => {
  await simularCep(page);
  await abrirFormulario(page);

  await page.fill("#nova-titulo", "Poste");
  await page.fill("#nova-descricao", "Curta demais para passar na validação do servidor.");
  await page.fill("#nova-cep", "69900000");
  await expect(page.locator("#nova-endereco")).toHaveValue("Rua de Teste E2E");
  await page.locator('input[name="declaracaoVeracidade"]').check();
  await page.getByRole("button", { name: "Enviar reclamação" }).click();

  // O servidor recusou (título curto, sem categoria) e disse onde...
  await expect(page.getByText(/Revise os 2 campos destacados/)).toBeVisible();
  await expect(page.getByText("O título deve ter ao menos 10 caracteres.")).toBeVisible();
  await expect(page.getByText("Selecione uma categoria.")).toBeVisible();

  // ...e nada do que foi digitado ou marcado se perdeu.
  await expect(page.locator("#nova-titulo")).toHaveValue("Poste");
  await expect(page.locator("#nova-descricao")).toHaveValue(
    "Curta demais para passar na validação do servidor."
  );
  await expect(page.locator("#nova-endereco")).toHaveValue("Rua de Teste E2E");
  await expect(page.locator('input[name="declaracaoVeracidade"]')).toBeChecked();
});

test("o progresso ao lado acompanha o preenchimento", async ({ page }) => {
  await simularCep(page);
  await abrirFormulario(page);

  const progresso = page.getByRole("progressbar");
  await expect(progresso).toHaveAttribute("aria-valuenow", "0");

  await page.fill("#nova-titulo", "Poste apagado na Rua das Acácias");
  await expect(progresso).toHaveAttribute("aria-valuenow", "1");

  // Título curto não conta.
  await page.fill("#nova-titulo", "Poste");
  await expect(progresso).toHaveAttribute("aria-valuenow", "0");
  await page.fill("#nova-titulo", "Poste apagado na Rua das Acácias");

  await page.fill("#nova-descricao", "O poste em frente ao número 120 está sem luz há duas semanas.");
  await page.locator('input[name="categoriaId"]').first().check({ force: true });
  await expect(progresso).toHaveAttribute("aria-valuenow", "3");

  // CEP preenche rua, bairro e cidade: a etapa de localização fecha sozinha.
  await page.fill("#nova-cep", "69900000");
  await expect(progresso).toHaveAttribute("aria-valuenow", "4");

  await page.locator('input[name="declaracaoVeracidade"]').check();
  await expect(progresso).toHaveAttribute("aria-valuenow", "5");
  await expect(page.getByText("Tudo pronto para enviar")).toBeVisible();
});

test("escolher fotos de novo soma às anteriores e o limite de 5 vale pro total", async ({ page }) => {
  await abrirFormulario(page);
  const input = page.locator("#imagens-input");

  await input.setInputFiles([foto("a.png"), foto("b.png")]);
  await expect(page.getByText("2 fotos selecionadas")).toBeVisible();

  await input.setInputFiles([foto("c.png")]);
  await expect(page.getByText("3 fotos selecionadas")).toBeVisible();
  await expect(page.locator('button:has(img[alt=""])')).toHaveCount(3);

  // Mais 3 estouram o limite (3 + 3 > 5): avisa e não muda nada.
  await input.setInputFiles([foto("d.png"), foto("e.png"), foto("f.png")]);
  await expect(page.getByText("Envie no máximo 5 imagens.")).toBeVisible();
  await expect(page.getByText("3 fotos selecionadas")).toBeVisible();

  await input.setInputFiles([foto("d.png"), foto("e.png")]);
  await expect(page.getByText("5 fotos selecionadas")).toBeVisible();
  await expect(page.getByText("Limite de fotos atingido")).toBeVisible();
});

test("o envio leva as fotos escolhidas, inclusive depois de remover uma", async ({ page }) => {
  await simularCep(page);
  await abrirFormulario(page);

  let corpo = "";
  await page.route("**/reclamacoes/nova", async (rota) => {
    if (rota.request().method() !== "POST") return rota.fallback();
    corpo = (rota.request().postDataBuffer() ?? Buffer.alloc(0)).toString("latin1");
    // Só inspeciona: não deixa chegar ao servidor (criaria a reclamação e
    // chamaria a moderação por IA).
    await rota.abort();
  });

  await page.fill("#nova-titulo", "Poste apagado na Rua das Acácias");
  await page.fill("#nova-descricao", "O poste em frente ao número 120 está sem luz há duas semanas.");
  await page.locator('input[name="categoriaId"]').first().check({ force: true });
  await page.fill("#nova-cep", "69900000");
  await expect(page.locator("#nova-endereco")).toHaveValue("Rua de Teste E2E");
  await page.locator('input[name="declaracaoVeracidade"]').check();

  await page.locator("#imagens-input").setInputFiles([foto("primeira.png"), foto("segunda.png")]);
  await expect(page.getByText("2 fotos selecionadas")).toBeVisible();
  await page.getByRole("button", { name: "Remover foto" }).first().click();
  await expect(page.getByText("1 foto selecionada")).toBeVisible();

  await page.getByRole("button", { name: "Enviar reclamação" }).click();
  await expect.poll(() => corpo).not.toBe("");

  expect(corpo).toContain('filename="segunda.png"');
  expect(corpo).not.toContain('filename="primeira.png"');
});
