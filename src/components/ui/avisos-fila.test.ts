import { describe, expect, it } from "vitest";

import { empilharAviso } from "./avisos-fila";

const aviso = (id: number, mensagem: string, tipo = "erro") => ({ id, tipo, mensagem });

describe("empilharAviso", () => {
  it("acrescenta o aviso novo ao fim da pilha", () => {
    const pilha = empilharAviso([aviso(1, "A")], aviso(2, "B"), 4);
    expect(pilha.map((a) => a.id)).toEqual([1, 2]);
  });

  it("não repete o aviso idêntico que ainda está na tela", () => {
    const atuais = [aviso(1, "Seu e-mail ainda não foi verificado.")];
    const pilha = empilharAviso(atuais, aviso(2, "Seu e-mail ainda não foi verificado."), 4);
    expect(pilha).toBe(atuais);
  });

  it("a mesma mensagem em outro tom é outro aviso", () => {
    const pilha = empilharAviso([aviso(1, "Pronto", "info")], aviso(2, "Pronto", "sucesso"), 4);
    expect(pilha).toHaveLength(2);
  });

  it("depois de fechado, o mesmo aviso pode voltar", () => {
    const pilha = empilharAviso([], aviso(3, "Seu e-mail ainda não foi verificado."), 4);
    expect(pilha).toHaveLength(1);
  });

  it("mantém só os mais recentes quando passa do limite", () => {
    let pilha = [] as ReturnType<typeof aviso>[];
    for (let i = 1; i <= 6; i++) pilha = empilharAviso(pilha, aviso(i, `Erro ${i}`), 4);
    expect(pilha.map((a) => a.id)).toEqual([3, 4, 5, 6]);
  });
});
