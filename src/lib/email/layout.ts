import { esc, htmlParaTexto } from "./html";

// Layout único dos e-mails do Urban Grid. E-mail NÃO é página web: cliente de
// e-mail ignora CSS moderno, então o HTML é de tabelas com estilo inline, sem
// imagem (o glifo da marca é feito de células de tabela - não depende de
// hospedar arquivo nem de o cliente carregar imagens), e o modo escuro entra
// por @media (prefers-color-scheme) com classes `em-*` marcadas !important.
// Regras completas na skill `email-transacional`.
//
// O mesmo conjunto de blocos gera as duas partes da mensagem (HTML e texto), pra
// elas nunca divergirem.

// Cores da identidade (mesmos valores de globals.css, em hex: e-mail não tem
// variável CSS).
const COR = {
  pagina: "#f2f4f7",
  cartao: "#ffffff",
  suave: "#edf0f4",
  fio: "#d9dfe7",
  tinta: "#0e1520",
  tinta2: "#2c3645",
  mudo: "#5a6676",
  marca: "#0a52c4",
  sobreMarca: "#ffffff",
  marcaSuave: "#e3ecfb",
  sinal: "#ffc20e",
  perigo: "#a31d1d",
  perigoSuave: "#fde8e8",
} as const;

const FONTE = "-apple-system,'Segoe UI',Helvetica,Arial,sans-serif";
const FONTE_MONO = "'SFMono-Regular',Consolas,'Courier New',monospace";

export type TomEmail = "padrao" | "alerta";

export type BlocoEmail =
  // Parágrafo: HTML já escapado/confiável (pode ter <strong>).
  | { tipo: "paragrafo"; html: string }
  // Caixa de destaque (ex.: motivo de uma rejeição): rótulo opcional + texto.
  | { tipo: "destaque"; rotulo?: string; html: string }
  // Linhas "rótulo → valor" (ex.: protocolo e status).
  | { tipo: "dados"; linhas: { rotulo: string; valor: string }[] }
  // Número grande com legenda (resumo semanal).
  | { tipo: "numero"; valor: string; rotulo: string };

export interface RotulosLayout {
  // "Se o botão não funcionar, copie e cole este endereço no navegador:"
  linkAlternativo: string;
  // "Este é um e-mail automático. Não responda a esta mensagem."
  automatico: string;
  // "Urban Grid — Trabalho de Conclusão de Curso"
  marca: string;
}

export interface OpcoesEmail {
  // Código BCP 47 do <html lang>.
  idioma: string;
  rotulos: RotulosLayout;
  assunto: string;
  // Texto que o cliente mostra ao lado do assunto na caixa de entrada. Texto
  // puro (é escapado aqui).
  preheader: string;
  // Rótulo pequeno acima do título ("Segurança da conta"). Texto puro.
  categoria: string;
  // Título do e-mail. Texto puro.
  titulo: string;
  tom?: TomEmail;
  blocos: BlocoEmail[];
  botao?: { texto: string; url: string };
  // Por que a pessoa está recebendo isto / o que fazer se não reconhece. Texto
  // puro, ou HTML já escapado em `rodapeHtml`.
  rodape?: string;
}

export interface EmailRenderizado {
  html: string;
  text: string;
}

// --------------------------------------------------------------------------
// pedaços do HTML

function glifo(): string {
  // Quatro quarteirões separados por ruas, como a marca do site: tinta, azul,
  // azul e amarelo de obra. Cada célula tem classe pra trocar no modo escuro.
  const celula = (cor: string, classe: string) =>
    `<td width="12" height="12" bgcolor="${cor}" class="${classe}" style="width:12px;height:12px;background:${cor};border-radius:2px;font-size:0;line-height:0;">&nbsp;</td>`;
  const rua = `<td width="3" style="width:3px;font-size:0;line-height:0;">&nbsp;</td>`;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;">
    <tr>${celula(COR.tinta, "em-bloco-tinta")}${rua}${celula(COR.marca, "em-bloco-marca")}</tr>
    <tr><td colspan="3" height="3" style="height:3px;font-size:0;line-height:0;">&nbsp;</td></tr>
    <tr>${celula(COR.marca, "em-bloco-marca")}${rua}${celula(COR.sinal, "")}</tr>
  </table>`;
}

function cabecalho(): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td style="padding-right:10px;vertical-align:middle;">${glifo()}</td>
      <td class="em-tinta" style="vertical-align:middle;font-family:${FONTE};font-size:21px;line-height:1;font-weight:800;letter-spacing:-0.4px;color:${COR.tinta};">Urban <span class="em-marca" style="color:${COR.marca};">Grid</span></td>
    </tr>
  </table>`;
}

function paragrafo(html: string): string {
  return `<p class="em-tinta2" style="margin:0 0 16px 0;font-family:${FONTE};font-size:16px;line-height:1.6;color:${COR.tinta2};">${html}</p>`;
}

function destaque(rotulo: string | undefined, html: string, tom: TomEmail): string {
  const alerta = tom === "alerta";
  const fundo = alerta ? COR.perigoSuave : COR.suave;
  const classeFundo = alerta ? "em-perigo-fundo" : "em-suave";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px 0;">
    <tr><td class="${classeFundo} em-fio" bgcolor="${fundo}" style="background:${fundo};border:1px solid ${COR.fio};border-radius:6px;padding:14px 16px;">
      ${
        rotulo
          ? `<div class="em-mudo" style="margin:0 0 6px 0;font-family:${FONTE_MONO};font-size:11px;line-height:16px;letter-spacing:1.2px;text-transform:uppercase;color:${COR.mudo};">${esc(rotulo)}</div>`
          : ""
      }
      <div class="em-tinta" style="font-family:${FONTE};font-size:15px;line-height:1.55;color:${COR.tinta};">${html}</div>
    </td></tr>
  </table>`;
}

function dados(linhas: { rotulo: string; valor: string }[]): string {
  const itens = linhas
    .map(
      (linha, i) => `<tr>
        <td class="em-mudo ${i > 0 ? "em-fio" : ""}" style="padding:10px 12px 10px 0;${i > 0 ? `border-top:1px solid ${COR.fio};` : ""}font-family:${FONTE};font-size:13px;color:${COR.mudo};vertical-align:top;" width="38%">${esc(linha.rotulo)}</td>
        <td class="em-tinta ${i > 0 ? "em-fio" : ""}" style="padding:10px 0;${i > 0 ? `border-top:1px solid ${COR.fio};` : ""}font-family:${FONTE};font-size:15px;font-weight:600;color:${COR.tinta};vertical-align:top;">${esc(linha.valor)}</td>
      </tr>`
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px 0;">${itens}</table>`;
}

function numero(valor: string, rotulo: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 20px 0;">
    <tr><td>
      <div class="em-tinta" style="font-family:${FONTE};font-size:56px;line-height:1;font-weight:800;letter-spacing:-2px;color:${COR.tinta};">${esc(valor)}</div>
      <div class="em-mudo" style="margin-top:8px;font-family:${FONTE_MONO};font-size:12px;line-height:16px;letter-spacing:1px;text-transform:uppercase;color:${COR.mudo};">${esc(rotulo)}</div>
    </td></tr>
  </table>`;
}

// Botão "à prova de Outlook": o Word (motor de renderização do Outlook no
// Windows) ignora padding e border-radius em <a>, então o Outlook recebe um
// retângulo VML; o resto recebe um <a> comum. A largura do VML não se ajusta ao
// texto, por isso é estimada pelo tamanho do rótulo.
function botao(texto: string, url: string, tom: TomEmail): string {
  const fundo = tom === "alerta" ? COR.perigo : COR.marca;
  const largura = Math.min(420, Math.max(200, 56 + texto.length * 9));
  const urlAttr = esc(url);
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 20px 0;">
    <tr><td align="center" bgcolor="${fundo}" class="em-botao" style="background:${fundo};border-radius:6px;">
      <!--[if mso]>
      <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${urlAttr}" style="height:48px;v-text-anchor:middle;width:${largura}px;" arcsize="12%" stroke="f" fillcolor="${fundo}">
        <w:anchorlock/>
        <center style="color:${COR.sobreMarca};font-family:Arial,sans-serif;font-size:16px;font-weight:bold;">${esc(texto)}</center>
      </v:roundrect>
      <![endif]-->
      <!--[if !mso]><!-- -->
      <a href="${urlAttr}" target="_blank" class="em-botao-a" style="display:inline-block;padding:14px 26px;font-family:${FONTE};font-size:16px;line-height:20px;font-weight:700;color:${COR.sobreMarca};text-decoration:none;border-radius:6px;">${esc(texto)}</a>
      <!--<![endif]-->
    </td></tr>
  </table>`;
}

function linkAlternativo(rotulo: string, url: string): string {
  return `<p class="em-mudo" style="margin:0;font-family:${FONTE};font-size:13px;line-height:1.5;color:${COR.mudo};">${esc(rotulo)}<br><a href="${esc(url)}" class="em-marca" style="color:${COR.marca};word-break:break-all;text-decoration:underline;">${esc(url)}</a></p>`;
}

// Estilos de <style>: só o que o inline não alcança (modo escuro, tela estreita,
// reset do Outlook). Sem !important o cliente escuro não sobrescreve o inline.
const ESTILOS = `
  body { margin:0 !important; padding:0 !important; width:100% !important; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
  table, td { mso-table-lspace:0pt; mso-table-rspace:0pt; }
  a { text-decoration:underline; }
  @media (max-width:620px) {
    .em-cartao { padding:26px 20px 22px 20px !important; }
    .em-h1 { font-size:24px !important; }
  }
  @media (prefers-color-scheme: dark) {
    .em-pagina { background:#0b0f16 !important; }
    .em-cartao { background:#121823 !important; border-color:#243042 !important; }
    .em-suave { background:#18202d !important; }
    .em-perigo-fundo { background:#331314 !important; }
    .em-fio { border-color:#243042 !important; }
    .em-tinta { color:#edf1f7 !important; }
    .em-tinta2 { color:#c5cedb !important; }
    .em-mudo { color:#93a0b3 !important; }
    .em-marca { color:#7ea6ff !important; }
    .em-botao { background:#7ea6ff !important; }
    .em-botao-a { color:#07142e !important; }
    .em-bloco-tinta { background:#edf1f7 !important; }
    .em-bloco-marca { background:#7ea6ff !important; }
  }
`;

// --------------------------------------------------------------------------
// versão em texto

function textoDoBloco(bloco: BlocoEmail): string {
  switch (bloco.tipo) {
    case "paragrafo":
      return htmlParaTexto(bloco.html);
    case "destaque":
      return `${bloco.rotulo ? `${bloco.rotulo}: ` : ""}${htmlParaTexto(bloco.html)}`;
    case "dados":
      return bloco.linhas.map((l) => `${l.rotulo}: ${l.valor}`).join("\n");
    case "numero":
      return `${bloco.valor} — ${bloco.rotulo}`;
  }
}

function montarTexto(opcoes: OpcoesEmail): string {
  const partes = [
    "URBAN GRID",
    `${opcoes.categoria.toUpperCase()}`,
    opcoes.titulo,
    ...opcoes.blocos.map(textoDoBloco),
  ];
  if (opcoes.botao) partes.push(`${opcoes.botao.texto}: ${opcoes.botao.url}`);
  partes.push("--");
  if (opcoes.rodape) partes.push(htmlParaTexto(opcoes.rodape));
  partes.push(opcoes.rotulos.automatico, opcoes.rotulos.marca);
  return partes.join("\n\n").replace(/\n\n--\n\n/, "\n\n--\n");
}

// --------------------------------------------------------------------------

export function montarEmail(opcoes: OpcoesEmail): EmailRenderizado {
  const tom = opcoes.tom ?? "padrao";
  const filete = tom === "alerta" ? COR.perigo : COR.sinal;

  const conteudo = opcoes.blocos
    .map((bloco) => {
      switch (bloco.tipo) {
        case "paragrafo":
          return paragrafo(bloco.html);
        case "destaque":
          return destaque(bloco.rotulo, bloco.html, tom);
        case "dados":
          return dados(bloco.linhas);
        case "numero":
          return numero(bloco.valor, bloco.rotulo);
      }
    })
    .join("\n");

  // O cliente completa a prévia com o começo do corpo; esses espaços invisíveis
  // empurram o resto do texto pra fora dela.
  const enchimento = "&#8199;&#847; ".repeat(40);

  const html = `<!DOCTYPE html>
<html lang="${esc(opcoes.idioma)}" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${esc(opcoes.assunto)}</title>
<!--[if mso]><xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
<style>${ESTILOS}</style>
</head>
<body class="em-pagina" style="margin:0;padding:0;background:${COR.pagina};">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${COR.pagina};opacity:0;">${esc(opcoes.preheader)}${enchimento}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${COR.pagina}" class="em-pagina" style="background:${COR.pagina};">
  <tr><td align="center" style="padding:32px 12px;">
    <!--[if mso]><table role="presentation" width="600" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">
      <tr><td align="left" style="padding:0 4px 20px 4px;">${cabecalho()}</td></tr>
      <tr><td class="em-cartao em-fio" bgcolor="${COR.cartao}" style="background:${COR.cartao};border:1px solid ${COR.fio};border-top:4px solid ${filete};border-radius:8px;padding:34px 34px 30px 34px;">
        <div class="em-mudo" style="margin:0 0 10px 0;font-family:${FONTE_MONO};font-size:11px;line-height:16px;letter-spacing:1.4px;text-transform:uppercase;color:${COR.mudo};">${esc(opcoes.categoria)}</div>
        <h1 class="em-h1 em-tinta" style="margin:0 0 20px 0;font-family:${FONTE};font-size:28px;line-height:1.2;font-weight:800;letter-spacing:-0.6px;color:${COR.tinta};">${esc(opcoes.titulo)}</h1>
        ${conteudo}
        ${opcoes.botao ? botao(opcoes.botao.texto, opcoes.botao.url, tom) : ""}
        ${opcoes.botao ? linkAlternativo(opcoes.rotulos.linkAlternativo, opcoes.botao.url) : ""}
      </td></tr>
      <tr><td style="padding:20px 4px 0 4px;">
        ${
          opcoes.rodape
            ? `<p class="em-mudo" style="margin:0 0 12px 0;font-family:${FONTE};font-size:13px;line-height:1.55;color:${COR.mudo};">${opcoes.rodape}</p>`
            : ""
        }
        <p class="em-mudo" style="margin:0;font-family:${FONTE_MONO};font-size:11px;line-height:1.6;letter-spacing:0.6px;color:${COR.mudo};">${esc(opcoes.rotulos.automatico)}<br>${esc(opcoes.rotulos.marca)}</p>
      </td></tr>
    </table>
    <!--[if mso]></td></tr></table><![endif]-->
  </td></tr>
</table>
</body>
</html>`;

  return { html, text: montarTexto(opcoes) };
}
