import { describe, expect, it } from "vitest";

import { criarComentarioSchema } from "./definitions";

// O schema só usa `t` para montar mensagens de erro: devolver a chave basta para os testes.
const t = ((chave: string) => chave) as unknown as Parameters<typeof criarComentarioSchema>[0];
const schema = criarComentarioSchema(t);

describe("criarComentarioSchema", () => {
  // Regressão: o formulário de comentário de nível zero não manda `paiId`, então a ação lê
  // `formData.get("paiId")` = null. O schema recusava com "Invalid input" e ninguém comentava.
  it.each([
    ["sem o campo", undefined],
    ["null (formData.get de campo ausente)", null],
    ["vazio", ""],
  ])("comentário de nível zero vale com paiId %s", (_, paiId) => {
    const resultado = schema.safeParse({ texto: "Concordo, passo por ali todo dia.", paiId });
    expect(resultado.success).toBe(true);
    expect(resultado.data?.paiId).toBeUndefined();
  });

  it("resposta mantém o paiId do comentário respondido", () => {
    const resultado = schema.safeParse({ texto: "Também vi isso.", paiId: "cm123" });
    expect(resultado.data?.paiId).toBe("cm123");
  });

  it("recusa comentário curto com a mensagem traduzida, não com o texto padrão do zod", () => {
    const resultado = schema.safeParse({ texto: "oi", paiId: null });
    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues[0]?.message).toBe("erroComentarioCurto");
  });

  it("recusa comentário longo demais", () => {
    const resultado = schema.safeParse({ texto: "a".repeat(1001), paiId: null });
    expect(resultado.error?.issues[0]?.message).toBe("erroComentarioLongo");
  });

  it("apara espaços do texto", () => {
    const resultado = schema.safeParse({ texto: "   Uma frase válida.   ", paiId: null });
    expect(resultado.data?.texto).toBe("Uma frase válida.");
  });
});
