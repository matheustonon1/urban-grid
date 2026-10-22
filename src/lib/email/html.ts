// Todo texto que veio de usuário (título de reclamação, motivo de
// rejeição, nome de órgão, resposta oficial...) e entra num template HTML
// precisa passar por aqui - sem isso, quem controla o texto injeta HTML/
// links dentro de um e-mail que sai do remetente oficial do sistema
// (phishing com aparência legítima).
export function esc(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const ENTIDADES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " ",
};

// Versão em texto puro de um trecho de HTML que a gente mesmo montou (só tem
// <strong>, <br> e parágrafos): vira a parte "text/plain" do e-mail, que quem
// usa cliente só-texto, leitor de tela ou filtro de spam ainda lê. Não é um
// conversor genérico de HTML - o conteúdo já foi escapado por esc().
export function htmlParaTexto(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g, (entidade) => ENTIDADES[entidade] ?? entidade)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// O assunto é cabeçalho de e-mail (texto puro): sem HTML, mas quebra de linha
// ali abre caminho pra injeção de cabeçalho (um "\r\nBcc: ..." vindo de um
// nome de cidade ou de órgão). Troca por espaço e apara.
export function assuntoSeguro(assunto: string): string {
  return assunto.replace(/[\r\n]+/g, " ").trim();
}
