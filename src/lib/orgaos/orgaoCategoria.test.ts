import { describe, expect, it } from "vitest";

import { orgaoAtendeCategoria } from "./orgaoCategoria";

describe("orgaoAtendeCategoria", () => {
  it("atende qualquer categoria quando o órgão não tem nenhuma atribuída", () => {
    expect(orgaoAtendeCategoria([], "cat-1")).toBe(true);
  });

  it("atende quando a categoria está entre as atribuídas", () => {
    expect(orgaoAtendeCategoria([{ id: "cat-1" }, { id: "cat-2" }], "cat-2")).toBe(true);
  });

  it("não atende quando a categoria não está entre as atribuídas", () => {
    expect(orgaoAtendeCategoria([{ id: "cat-1" }, { id: "cat-2" }], "cat-3")).toBe(false);
  });
});
