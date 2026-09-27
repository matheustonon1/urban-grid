import { describe, expect, it } from "vitest";

import { esc } from "./email";

describe("esc", () => {
  it("escapa os caracteres especiais de HTML", () => {
    expect(esc(`<script>alert("x & 'y'")</script>`)).toBe(
      "&lt;script&gt;alert(&quot;x &amp; &#39;y&#39;&quot;)&lt;/script&gt;"
    );
  });

  it("não altera texto sem caracteres especiais", () => {
    expect(esc("Prefeitura de São Paulo")).toBe("Prefeitura de São Paulo");
  });

  it("neutraliza uma tentativa de injetar uma tag/link no e-mail", () => {
    const nomeMalicioso = `Órgão</p><a href="https://phishing.exemplo">clique aqui</a><p>`;
    const escapado = esc(nomeMalicioso);
    expect(escapado).not.toContain("<a ");
    expect(escapado).not.toContain("</p>");
    expect(escapado).toContain("&lt;a href=&quot;https://phishing.exemplo&quot;&gt;");
  });
});
