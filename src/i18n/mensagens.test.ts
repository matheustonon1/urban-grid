import { describe, expect, it } from "vitest";

import en from "../../messages/en.json";
import ptBR from "../../messages/pt-BR.json";

type Arvore = { [chave: string]: string | Arvore };

// "Home.passo1Titulo" -> texto, para comparar as duas línguas chave a chave.
function achatar(arvore: Arvore, prefixo = ""): Record<string, string> {
  const saida: Record<string, string> = {};
  for (const [chave, valor] of Object.entries(arvore)) {
    const caminho = prefixo ? `${prefixo}.${chave}` : chave;
    if (typeof valor === "string") saida[caminho] = valor;
    else Object.assign(saida, achatar(valor, caminho));
  }
  return saida;
}

// Nomes dos parâmetros ICU de uma mensagem ("{count, plural, ...}" -> "count"),
// ignorando o que vem dentro das ramificações de plural/select.
function parametros(mensagem: string): string[] {
  const nomes = new Set<string>();
  let profundidade = 0;
  let inicio = -1;
  for (let i = 0; i < mensagem.length; i++) {
    const c = mensagem[i];
    if (c === "{") {
      if (profundidade === 0) inicio = i + 1;
      profundidade++;
    } else if (c === "}") {
      profundidade--;
      if (profundidade === 0 && inicio >= 0) {
        const nome = mensagem.slice(inicio, i).split(",")[0].trim();
        if (nome) nomes.add(nome);
        inicio = -1;
      }
    }
  }
  return [...nomes].sort();
}

const textosPt = achatar(ptBR as Arvore);
const textosEn = achatar(en as Arvore);

describe("messages/*.json", () => {
  it("tem exatamente as mesmas chaves em pt-BR e en", () => {
    const soNoPt = Object.keys(textosPt).filter((chave) => !(chave in textosEn));
    const soNoEn = Object.keys(textosEn).filter((chave) => !(chave in textosPt));

    expect({ soNoPt, soNoEn }).toEqual({ soNoPt: [], soNoEn: [] });
  });

  it("usa os mesmos parâmetros ICU nas duas línguas", () => {
    const divergentes = Object.keys(textosPt)
      .filter((chave) => chave in textosEn)
      .filter((chave) => parametros(textosPt[chave]).join() !== parametros(textosEn[chave]).join())
      .map((chave) => ({
        chave,
        pt: parametros(textosPt[chave]),
        en: parametros(textosEn[chave]),
      }));

    expect(divergentes).toEqual([]);
  });

  it("não deixa mensagem vazia", () => {
    const vazias = [...Object.entries(textosPt), ...Object.entries(textosEn)]
      .filter(([, texto]) => texto.trim() === "")
      .map(([chave]) => chave);

    expect(vazias).toEqual([]);
  });
});
