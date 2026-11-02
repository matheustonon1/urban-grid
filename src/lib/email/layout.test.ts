import { describe, expect, it } from "vitest";

import { assuntoSeguro, htmlParaTexto } from "./html";
import { montarEmail, type OpcoesEmail } from "./layout";

const rotulos = {
  linkAlternativo: "Se o botão não funcionar, copie e cole este endereço:",
  automatico: "Este é um e-mail automático.",
  marca: "Urban Grid — TCC",
};

function opcoes(extra: Partial<OpcoesEmail> = {}): OpcoesEmail {
  return {
    idioma: "pt-BR",
    rotulos,
    assunto: "Assunto de teste",
    preheader: "Prévia na caixa de entrada",
    categoria: "Sua conta",
    titulo: "Título do e-mail",
    blocos: [{ tipo: "paragrafo", html: "Olá, <strong>Maria</strong>." }],
    ...extra,
  };
}

describe("montarEmail", () => {
  it("devolve HTML completo, com idioma, pré-cabeçalho e marca", () => {
    const { html } = montarEmail(opcoes());

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain('<html lang="pt-BR"');
    expect(html).toContain("Prévia na caixa de entrada");
    expect(html).toContain("Título do e-mail");
    expect(html).toContain("Urban");
  });

  it("declara suporte ao modo escuro e tem regras para ele", () => {
    const { html } = montarEmail(opcoes());

    expect(html).toContain('name="color-scheme" content="light dark"');
    expect(html).toContain("@media (prefers-color-scheme: dark)");
  });

  it("não depende de imagem nem de script", () => {
    const { html } = montarEmail(opcoes({ botao: { texto: "Abrir", url: "https://exemplo.com/x" } }));

    expect(html).not.toMatch(/<img\b/i);
    expect(html).not.toMatch(/<script\b/i);
  });

  it("escapa título, categoria, preheader e o texto do botão (vêm de fora)", () => {
    const { html } = montarEmail(
      opcoes({
        titulo: `<script>alert(1)</script>`,
        categoria: `Cat "A" & B`,
        preheader: `<b>x</b>`,
        botao: { texto: `<i>Abrir</i>`, url: "https://exemplo.com/x" },
      })
    );

    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("Cat &quot;A&quot; &amp; B");
    expect(html).toContain("&lt;b&gt;x&lt;/b&gt;");
    expect(html).toContain("&lt;i&gt;Abrir&lt;/i&gt;");
  });

  it("neutraliza aspas na URL do botão (não dá pra fechar o atributo href)", () => {
    const { html } = montarEmail(
      opcoes({ botao: { texto: "Abrir", url: `https://exemplo.com/"><a href="https://phishing.exemplo` } })
    );

    expect(html).not.toContain(`"><a href="https://phishing.exemplo`);
    expect(html).toContain("&quot;&gt;&lt;a href=&quot;https://phishing.exemplo");
  });

  it("com botão, mostra o botão (inclusive o retângulo VML do Outlook) e o link por extenso", () => {
    const url = "https://exemplo.com/redefinir/abc123";
    const { html, text } = montarEmail(opcoes({ botao: { texto: "Criar nova senha", url } }));

    expect(html).toContain("Criar nova senha");
    expect(html).toContain("<v:roundrect");
    expect(html).toContain(rotulos.linkAlternativo);
    // a URL aparece no href do botão, no href do VML e por extenso
    expect(html.split(url).length - 1).toBeGreaterThanOrEqual(3);
    expect(text).toContain(`Criar nova senha: ${url}`);
  });

  it("sem botão, não imprime o aviso de link alternativo", () => {
    const { html } = montarEmail(opcoes());

    expect(html).not.toContain(rotulos.linkAlternativo);
    expect(html).not.toContain("<v:roundrect");
  });

  it("e-mail de alerta usa o filete vermelho; o padrão, o amarelo de obra", () => {
    expect(montarEmail(opcoes({ tom: "alerta" })).html).toContain("border-top:4px solid #a31d1d");
    expect(montarEmail(opcoes()).html).toContain("border-top:4px solid #ffc20e");
  });

  it("renderiza destaque, dados e número", () => {
    const { html, text } = montarEmail(
      opcoes({
        blocos: [
          { tipo: "destaque", rotulo: "Motivo", html: "Falta documento" },
          { tipo: "dados", linhas: [{ rotulo: "Protocolo", valor: "UG-2026-0000042" }] },
          { tipo: "numero", valor: "7", rotulo: "novas reclamações" },
        ],
      })
    );

    expect(html).toContain("Falta documento");
    expect(html).toContain("UG-2026-0000042");
    expect(html).toContain("novas reclamações");
    expect(text).toContain("Motivo: Falta documento");
    expect(text).toContain("Protocolo: UG-2026-0000042");
    expect(text).toContain("7 — novas reclamações");
  });

  it("gera uma versão em texto puro com título, corpo, rodapé e sem HTML", () => {
    const { text } = montarEmail(
      opcoes({
        botao: { texto: "Abrir", url: "https://exemplo.com/x" },
        rodape: "Se não foi você, ignore. &amp; pronto",
      })
    );

    expect(text).toContain("URBAN GRID");
    expect(text).toContain("SUA CONTA");
    expect(text).toContain("Título do e-mail");
    expect(text).toContain("Olá, Maria.");
    expect(text).toContain("Se não foi você, ignore. & pronto");
    expect(text).toContain(rotulos.automatico);
    expect(text).not.toMatch(/<[a-z/][^>]*>/i);
  });
});

describe("htmlParaTexto", () => {
  it("remove tags, converte quebras e decodifica as entidades que esc() produz", () => {
    expect(htmlParaTexto("A &amp; B<br>C &lt;d&gt; &quot;e&quot; &#39;f&#39;")).toBe(
      `A & B\nC <d> "e" 'f'`
    );
  });
});

describe("assuntoSeguro", () => {
  it("troca quebras de linha por espaço (evita injeção de cabeçalho)", () => {
    expect(assuntoSeguro("Resumo\r\nBcc: alguem@exemplo.com")).toBe("Resumo Bcc: alguem@exemplo.com");
  });

  it("não escapa HTML (assunto é texto puro)", () => {
    expect(assuntoSeguro("D'Oeste & cia")).toBe("D'Oeste & cia");
  });
});
