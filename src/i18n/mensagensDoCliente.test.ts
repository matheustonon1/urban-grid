import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import en from "../../messages/en.json";
import ptBR from "../../messages/pt-BR.json";
import { NAMESPACES_DO_CLIENTE, selecionarMensagens } from "./mensagensDoCliente";

// Guarda de `NAMESPACES_DO_CLIENTE`: segue as importações de cada rota e junta os namespaces de
// `useTranslations("X")` que podem rodar no navegador. Só contam arquivos alcançados DEPOIS de
// cruzar uma fronteira "use client": um Server Component que usa `useTranslations` roda no servidor
// e lê o catálogo completo de lá.

const SRC = path.join(process.cwd(), "src");

interface Arquivo {
  cliente: boolean;
  namespaces: string[];
  imports: string[];
}

const cacheDeArquivos = new Map<string, Arquivo>();

function listar(dir: string, saida: string[] = []): string[] {
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    const caminho = path.join(dir, entrada.name);
    if (entrada.isDirectory()) {
      if (entrada.name !== "generated" && entrada.name !== "node_modules") listar(caminho, saida);
    } else if (/\.tsx?$/.test(entrada.name) && !/\.test\.tsx?$/.test(entrada.name)) {
      saida.push(caminho);
    }
  }
  return saida;
}

function resolver(de: string, especificador: string): string | null {
  const base = especificador.startsWith("@/")
    ? path.join(SRC, especificador.slice(2))
    : especificador.startsWith(".")
      ? path.resolve(path.dirname(de), especificador)
      : null;
  if (!base) return null;
  const candidatos = [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts"), path.join(base, "index.tsx")];
  return candidatos.find((c) => fs.existsSync(c) && fs.statSync(c).isFile()) ?? null;
}

function ler(arquivo: string): Arquivo {
  const guardado = cacheDeArquivos.get(arquivo);
  if (guardado) return guardado;
  const texto = fs.readFileSync(arquivo, "utf8");
  const lido: Arquivo = {
    cliente: /^\s*["']use client["']/m.test(texto),
    namespaces: [...texto.matchAll(/useTranslations\(\s*["'`]([^"'`]+)["'`]\s*\)/g)].map((m) => m[1]),
    imports: [
      ...texto.matchAll(/(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?["']([^"']+)["']/g),
    ]
      .map((m) => resolver(arquivo, m[1]))
      .filter((c): c is string => c !== null),
  };
  cacheDeArquivos.set(arquivo, lido);
  return lido;
}

function namespacesNoNavegador(entrada: string, achados: Map<string, string>) {
  const visitados = new Set<string>();
  const pilha: Array<[string, boolean]> = [[entrada, ler(entrada).cliente]];
  while (pilha.length) {
    const [arquivo, noCliente] = pilha.pop()!;
    const chave = `${arquivo}|${noCliente}`;
    if (visitados.has(chave)) continue;
    visitados.add(chave);
    const lido = ler(arquivo);
    const emCliente = noCliente || lido.cliente;
    if (emCliente) {
      for (const namespace of lido.namespaces) {
        if (!achados.has(namespace)) achados.set(namespace, path.relative(process.cwd(), arquivo));
      }
    }
    for (const dependencia of lido.imports) pilha.push([dependencia, emCliente]);
  }
}

// Convenções de arquivo do App Router que o Next renderiza: dali parte o que pode ir ao navegador.
const ENTRADAS_DE_ROTA = /[\\/](page|layout|template|error|global-error|not-found|loading)\.tsx?$/;

describe("NAMESPACES_DO_CLIENTE", () => {
  const achados = new Map<string, string>();
  for (const arquivo of listar(path.join(SRC, "app")).filter((f) => ENTRADAS_DE_ROTA.test(f))) {
    namespacesNoNavegador(arquivo, achados);
  }

  it("inclui todo namespace que um componente de cliente pode pedir", () => {
    const faltando = [...achados].filter(([namespace]) => !(NAMESPACES_DO_CLIENTE as readonly string[]).includes(namespace));
    expect(
      faltando.map(([namespace, arquivo]) => `${namespace} (useTranslations em ${arquivo})`),
      "acrescente o namespace em NAMESPACES_DO_CLIENTE (src/i18n/mensagensDoCliente.ts), senão o navegador mostra a chave crua"
    ).toEqual([]);
  });

  it("não guarda namespace que nenhum componente de cliente usa mais", () => {
    const sobrando = NAMESPACES_DO_CLIENTE.filter((namespace) => !achados.has(namespace));
    expect(sobrando, "remova-os da lista: cada um é peso a mais no HTML de toda página").toEqual([]);
  });

  it.each([
    ["pt-BR", ptBR],
    ["en", en],
  ])("todo namespace listado existe em %s", (_, catalogo) => {
    const inexistentes = NAMESPACES_DO_CLIENTE.filter((namespace) => !(namespace in catalogo));
    expect(inexistentes).toEqual([]);
  });
});

describe("selecionarMensagens", () => {
  it("devolve só os namespaces pedidos e ignora os que o catálogo não tem", () => {
    const catalogo = { A: { x: "1" }, B: { y: "2" } };
    expect(selecionarMensagens(catalogo, ["A", "Z"])).toEqual({ A: { x: "1" } });
  });

  it("o recorte do cliente é bem menor que o catálogo inteiro", () => {
    const inteiro = JSON.stringify(ptBR).length;
    const recorte = JSON.stringify(selecionarMensagens(ptBR)).length;
    expect(recorte).toBeLessThan(inteiro * 0.6);
  });
});
