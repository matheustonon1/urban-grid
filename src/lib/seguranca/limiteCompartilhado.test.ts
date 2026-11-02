import { beforeEach, describe, expect, it, vi } from "vitest";

// vi.mock é içado para o topo do arquivo: o que a fábrica usa precisa vir de vi.hoisted.
// O módulo usa uma transação interativa; o mock a executa na hora com as mesmas funções.
const { executar, consultar } = vi.hoisted(() => ({ executar: vi.fn(), consultar: vi.fn() }));

vi.mock("@/lib/prisma", () => {
  const tx = { $executeRaw: executar, $queryRaw: consultar };
  return {
    prisma: {
      $transaction: (fn: (t: typeof tx) => unknown) => fn(tx),
      $executeRaw: executar,
      $queryRaw: consultar,
    },
  };
});

import { excedeuLimiteCompartilhado } from "./limiteCompartilhado";

// Os valores de um template tagged ($executeRaw`... ${x}`) chegam como argumentos depois do array
// de partes do SQL.
const valoresDe = (chamada: unknown[]) => chamada.slice(1);
const futuro = () => new Date(Date.now() + 60_000);

beforeEach(() => {
  executar.mockReset().mockResolvedValue(1);
  consultar.mockReset();
  vi.stubEnv("AUTH_SECRET", "segredo-de-teste");
});

describe("excedeuLimiteCompartilhado", () => {
  it("libera até o limite e bloqueia acima dele, pela contagem que o banco devolve", async () => {
    consultar.mockResolvedValueOnce([{ contagem: 3, expiraEm: futuro() }]);
    expect(await excedeuLimiteCompartilhado("teste", "chave", 3, 60_000)).toBe(false);

    consultar.mockResolvedValueOnce([{ contagem: 4, expiraEm: futuro() }]);
    expect(await excedeuLimiteCompartilhado("teste", "chave", 3, 60_000)).toBe(true);
  });

  it("a contagem de outra instância vale: quem decide é o banco, não a memória deste processo", async () => {
    // Nenhuma chamada anterior neste processo, mas a tabela já está acima do limite.
    consultar.mockResolvedValueOnce([{ contagem: 99, expiraEm: futuro() }]);
    expect(await excedeuLimiteCompartilhado("teste", "so-aqui", 5, 60_000)).toBe(true);
  });

  it("janela vencida: o pedido abre uma nova, valendo 1, e a linha é reiniciada", async () => {
    // O banco incrementou uma linha cuja janela já tinha acabado (contagem velha de 50).
    consultar.mockResolvedValueOnce([{ contagem: 51, expiraEm: new Date(Date.now() - 1000) }]);

    expect(await excedeuLimiteCompartilhado("teste", "chave", 5, 60_000)).toBe(false);

    const sqls = executar.mock.calls.map((c) => String((c[0] as string[]).join("?")));
    expect(sqls.some((sql) => sql.includes("UPDATE LimiteAbuso SET contagem = 1"))).toBe(true);
  });

  it("janela vigente: não reinicia a linha", async () => {
    consultar.mockResolvedValueOnce([{ contagem: 2, expiraEm: futuro() }]);

    await excedeuLimiteCompartilhado("teste", "chave", 5, 60_000);

    const sqls = executar.mock.calls.map((c) => String((c[0] as string[]).join("?")));
    expect(sqls.some((sql) => sql.includes("UPDATE LimiteAbuso SET contagem = 1"))).toBe(false);
  });

  it("sem chave identificável, nunca bloqueia nem toca no banco", async () => {
    expect(await excedeuLimiteCompartilhado("teste", null, 1, 60_000)).toBe(false);
    expect(executar).not.toHaveBeenCalled();
    expect(consultar).not.toHaveBeenCalled();
  });

  it("nunca grava a chave em claro: só o HMAC dela, e muda com o escopo", async () => {
    consultar.mockResolvedValue([{ contagem: 1, expiraEm: futuro() }]);
    const email = "pessoa@exemplo.com";

    await excedeuLimiteCompartilhado("redefinir-senha-email", email, 5, 60_000);
    await excedeuLimiteCompartilhado("troca-email", email, 5, 60_000);

    const ids = new Set<string>();
    for (const chamada of [...executar.mock.calls, ...consultar.mock.calls]) {
      for (const valor of valoresDe(chamada)) {
        expect(String(valor)).not.toContain(email);
        if (typeof valor === "string") ids.add(valor);
      }
    }
    // Dois escopos para o mesmo e-mail = dois ids diferentes, de 64 hex cada.
    expect(ids.size).toBe(2);
    for (const id of ids) expect(id).toMatch(/^[0-9a-f]{64}$/);
  });

  it("se o banco falhar, cai para o limite em memória em vez de derrubar a ação", async () => {
    executar.mockRejectedValue(new Error("banco fora do ar"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const escopo = `falha-${Date.now()}`;

    expect(await excedeuLimiteCompartilhado(escopo, "x", 1, 60_000)).toBe(false);
    // Segunda chamada na mesma janela: a memória deste processo já conta.
    expect(await excedeuLimiteCompartilhado(escopo, "x", 1, 60_000)).toBe(true);
  });
});
