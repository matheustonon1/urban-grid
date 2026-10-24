// Gera o HTML (e o texto) de todos os e-mails, nos dois idiomas, em
// .email-previa/ - pra abrir no navegador e conferir o visual sem enviar nada.
//
//   npm run email:previa
//
// Os dados são de exemplo (inclusive com caracteres que precisam de escape) e a
// pasta é ignorada pelo git.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { IDIOMAS } from "@/i18n/config";

import {
  montarEmailAcessoOrgao,
  montarEmailCidadeAprovada,
  montarEmailConfirmarTrocaEmail,
  montarEmailNotificacao,
  montarEmailRedefinicaoSenha,
  montarEmailResumoSemanal,
  montarEmailSenhaAlterada,
  montarEmailSolicitacaoCidadeRejeitada,
  montarEmailSolicitacaoRejeitada,
  montarEmailTrocaEmailSolicitada,
  montarEmailVerificacao,
} from "./templates";

const SAIDA = join(process.cwd(), ".email-previa");
const TOKEN = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

async function main() {
  mkdirSync(SAIDA, { recursive: true });
  const indice: string[] = [];

  for (const locale of IDIOMAS) {
    const emails = {
      "verificacao": await montarEmailVerificacao({ token: TOKEN, locale }),
      "acesso-orgao": await montarEmailAcessoOrgao({
        token: TOKEN,
        nomeOrgao: "Secretaria Municipal de Obras",
        locale,
      }),
      "redefinicao-senha": await montarEmailRedefinicaoSenha({ token: TOKEN, locale }),
      "senha-alterada": await montarEmailSenhaAlterada({ locale }),
      "confirmar-troca-email": await montarEmailConfirmarTrocaEmail({
        token: TOKEN,
        emailAtual: "maria.silva@exemplo.com",
        locale,
      }),
      "troca-email-solicitada": await montarEmailTrocaEmailSolicitada({
        novoEmail: "maria.nova@exemplo.com",
        locale,
      }),
      "solicitacao-rejeitada": await montarEmailSolicitacaoRejeitada({
        motivo: "Não conseguimos comprovar o vínculo com o órgão <Secretaria de Obras> & a prefeitura.",
        locale,
      }),
      "cidade-aprovada": await montarEmailCidadeAprovada({
        nomeCidade: "Santa Isabel D'Oeste",
        locale,
      }),
      "cidade-rejeitada": await montarEmailSolicitacaoCidadeRejeitada({
        motivo: "A cidade já está cadastrada com outro nome. Procure por “Oeste” na busca.",
        locale,
      }),
      "notificacao": await montarEmailNotificacao({
        titulo: "Sua reclamação foi publicada",
        mensagem:
          "A reclamação “Buraco profundo na Avenida Brasil” passou pela moderação e já está visível para todos.",
        protocolo: "UG-2026-0000042",
        locale,
      }),
      "resumo-semanal": await montarEmailResumoSemanal({
        nomeCidade: "Santa Isabel D'Oeste",
        nomeCategoria: "Iluminação pública",
        total: 7,
        url: "http://localhost:3000/cidades/santa-isabel-doeste-pr",
        locale,
      }),
    };

    for (const [nome, email] of Object.entries(emails)) {
      const base = `${nome}.${locale}`;
      writeFileSync(join(SAIDA, `${base}.html`), email.html);
      writeFileSync(join(SAIDA, `${base}.txt`), `Assunto: ${email.assunto}\n\n${email.text}\n`);
      indice.push(`<li><a href="${base}.html">${base}</a> — ${email.assunto}</li>`);
    }
  }

  writeFileSync(
    join(SAIDA, "index.html"),
    `<!doctype html><meta charset="utf-8"><title>Prévia dos e-mails</title><body style="font-family:sans-serif;max-width:720px;margin:2rem auto"><h1>Prévia dos e-mails</h1><ul>${indice.join("")}</ul></body>`
  );
  console.log(`${indice.length} e-mails em ${SAIDA}`);
}

main();
