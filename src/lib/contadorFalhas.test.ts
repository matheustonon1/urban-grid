import { beforeEach, describe, expect, it, vi } from "vitest";

// Fake em memória do que o prisma.user.update precisa suportar aqui:
// incremento atômico ({ increment: 1 }) e escrita direta de valor. Não é
// um mock de chamadas (não interessa QUANTAS vezes foi chamado) - é uma
// simulação simples o bastante pra testar o comportamento de verdade do
// contador (atinge o limite, bloqueia, reseta), sem precisar de um banco.
const registros = new Map<string, Record<string, unknown>>();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      update: vi.fn(async ({ where, data, select }: {
        where: { id: string };
        data: Record<string, unknown>;
        select?: Record<string, boolean>;
      }) => {
        const atual = registros.get(where.id) ?? {};
        for (const [campo, valor] of Object.entries(data)) {
          if (valor && typeof valor === "object" && "increment" in valor) {
            atual[campo] = ((atual[campo] as number) ?? 0) + (valor as { increment: number }).increment;
          } else {
            atual[campo] = valor;
          }
        }
        registros.set(where.id, atual);

        if (!select) return atual;
        const selecionado: Record<string, unknown> = {};
        for (const campo of Object.keys(select)) {
          selecionado[campo] = atual[campo];
        }
        return selecionado;
      }),
    },
  },
}));

const { criarContadorDeFalhas } = await import("./contadorFalhas");

beforeEach(() => {
  registros.clear();
});

describe("criarContadorDeFalhas", () => {
  const contador = criarContadorDeFalhas({
    campoTentativas: "loginTentativasFalhas",
    campoBloqueio: "loginBloqueadoAte",
    limiteTentativas: 3,
    bloqueioMs: 60_000,
  });

  it("não bloqueia antes de atingir o limite de tentativas", async () => {
    const userId = "user-1";
    await contador.registrarFalha(userId);
    await contador.registrarFalha(userId);

    const usuario = registros.get(userId)!;
    expect(usuario.loginTentativasFalhas).toBe(2);
    expect(contador.estaBloqueado(usuario as { loginBloqueadoAte: Date | null })).toBe(false);
  });

  it("bloqueia e zera o contador ao atingir o limite", async () => {
    const userId = "user-2";
    await contador.registrarFalha(userId);
    await contador.registrarFalha(userId);
    await contador.registrarFalha(userId);

    const usuario = registros.get(userId)!;
    expect(usuario.loginTentativasFalhas).toBe(0);
    expect(contador.estaBloqueado(usuario as { loginBloqueadoAte: Date | null })).toBe(true);
  });

  it("estaBloqueado retorna false depois que o prazo do bloqueio já passou", () => {
    const usuario = { loginBloqueadoAte: new Date(Date.now() - 1000) };
    expect(contador.estaBloqueado(usuario)).toBe(false);
  });

  it("estaBloqueado retorna false sem nenhum bloqueio registrado", () => {
    expect(contador.estaBloqueado({ loginBloqueadoAte: null })).toBe(false);
  });

  it("resetarFalhas zera o contador e limpa o bloqueio", async () => {
    const userId = "user-3";
    await contador.registrarFalha(userId);
    await contador.registrarFalha(userId);
    await contador.registrarFalha(userId);
    expect(registros.get(userId)!.loginBloqueadoAte).not.toBeNull();

    await contador.resetarFalhas(userId);

    const usuario = registros.get(userId)!;
    expect(usuario.loginTentativasFalhas).toBe(0);
    expect(usuario.loginBloqueadoAte).toBeNull();
  });

  it("duas instâncias com campos diferentes (login vs totp) não interferem uma na outra", async () => {
    const contadorTotp = criarContadorDeFalhas({
      campoTentativas: "totpTentativasFalhas",
      campoBloqueio: "totpBloqueadoAte",
      limiteTentativas: 5,
      bloqueioMs: 300_000,
    });

    const userId = "user-4";
    await contador.registrarFalha(userId);
    await contadorTotp.registrarFalha(userId);

    const usuario = registros.get(userId)!;
    expect(usuario.loginTentativasFalhas).toBe(1);
    expect(usuario.totpTentativasFalhas).toBe(1);
  });
});
