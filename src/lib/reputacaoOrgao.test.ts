import { describe, expect, it } from "vitest";

import { classificarIndice } from "./reputacaoOrgao";

describe("classificarIndice", () => {
  it("marca como 'poucosDados' quando não há índice", () => {
    expect(classificarIndice(null, 0)).toEqual(
      expect.objectContaining({ chave: "poucosDados" })
    );
  });

  it("marca como 'poucosDados' com amostra pequena, mesmo com índice alto", () => {
    expect(classificarIndice(100, 1)).toEqual(
      expect.objectContaining({ chave: "poucosDados" })
    );
  });

  it("classifica 80% ou mais como otimo", () => {
    expect(classificarIndice(80, 10)).toEqual(expect.objectContaining({ chave: "otimo" }));
    expect(classificarIndice(100, 10)).toEqual(expect.objectContaining({ chave: "otimo" }));
  });

  it("classifica entre 60% e 79% como bom", () => {
    expect(classificarIndice(60, 10)).toEqual(expect.objectContaining({ chave: "bom" }));
    expect(classificarIndice(79, 10)).toEqual(expect.objectContaining({ chave: "bom" }));
  });

  it("classifica entre 40% e 59% como regular", () => {
    expect(classificarIndice(40, 10)).toEqual(expect.objectContaining({ chave: "regular" }));
    expect(classificarIndice(59, 10)).toEqual(expect.objectContaining({ chave: "regular" }));
  });

  it("classifica abaixo de 40% como ruim", () => {
    expect(classificarIndice(0, 10)).toEqual(expect.objectContaining({ chave: "ruim" }));
    expect(classificarIndice(39, 10)).toEqual(expect.objectContaining({ chave: "ruim" }));
  });
});
