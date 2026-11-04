// Gate de auditoria de dependências do CI.
//
//   node scripts/auditar-dependencias.mjs
//
// Roda `npm audit --omit=dev` (o que vai para produção) e FALHA se houver advisory de severidade
// alta ou crítica que não esteja em EXCECOES. O `--audit-level` do próprio npm não serve aqui:
// ele barraria também o que já foi avaliado e aceito, e o CI ficaria vermelho para sempre (e
// alguém acabaria desligando o passo). Cada exceção é um ID de advisory (não um nome de pacote):
// um advisory NOVO no mesmo pacote continua derrubando o CI.
//
// Para aceitar um advisory: explique por que a exposição é nula ou aceitável e quando revisar.
// Uma exceção que deixou de aparecer é avisada, para a lista não acumular entulho.
import { execSync } from "node:child_process";

// Nenhuma exceção aberta. A última (GHSA-ggr8-5vv4-36mx, deepmerge-ts via @prisma/config) saiu com
// a migração para o Prisma 7, cuja versão do CLI já não depende da biblioteca afetada. Para
// aceitar um advisory de novo: chave = ID do advisory, com pacote, motivo e quando revisar.
const EXCECOES = {};

const SEVERIDADES_QUE_BARRAM = new Set(["high", "critical"]);

function auditar() {
  try {
    return execSync("npm audit --omit=dev --json", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (erro) {
    // npm audit sai com código 1 quando acha algo, mas o JSON vem no stdout do mesmo jeito.
    if (erro.stdout) return erro.stdout;
    throw erro;
  }
}

const relatorio = JSON.parse(auditar());
if (relatorio.error) {
  console.error("Falha ao auditar:", relatorio.error.summary ?? relatorio.error);
  process.exit(2);
}

// Um advisory de verdade é o objeto em `via` (as strings são só a cadeia de quem depende dele).
const advisories = new Map();
for (const vulnerabilidade of Object.values(relatorio.vulnerabilities ?? {})) {
  for (const via of vulnerabilidade.via) {
    if (typeof via === "string") continue;
    const id = via.url?.split("/").pop() ?? `${via.name}:${via.title}`;
    advisories.set(id, { id, pacote: via.name, severidade: via.severity, titulo: via.title, url: via.url });
  }
}

const barram = [];
const aceitos = [];
for (const advisory of advisories.values()) {
  if (!SEVERIDADES_QUE_BARRAM.has(advisory.severidade)) continue;
  (EXCECOES[advisory.id] ? aceitos : barram).push(advisory);
}

for (const advisory of aceitos) {
  const excecao = EXCECOES[advisory.id];
  console.log(`aceito   ${advisory.severidade.padEnd(8)} ${advisory.id}  ${excecao.pacote}`);
  console.log(`         ${excecao.motivo}`);
  console.log(`         revisar: ${excecao.revisar}`);
}

const obsoletas = Object.keys(EXCECOES).filter((id) => !advisories.has(id));
for (const id of obsoletas) {
  console.log(`aviso    a exceção ${id} não aparece mais na auditoria: pode sair de EXCECOES.`);
}

if (barram.length > 0) {
  console.error("\nVulnerabilidades de produção sem exceção:");
  for (const advisory of barram) {
    console.error(`  ${advisory.severidade.padEnd(8)} ${advisory.pacote}: ${advisory.titulo}\n           ${advisory.url}`);
  }
  console.error("\nAtualize a dependência (npm audit fix) ou, se a exposição for aceitável, registre em EXCECOES.");
  process.exit(1);
}

console.log(`\nAuditoria ok: nenhum advisory alto ou crítico de produção sem exceção (${aceitos.length} aceito).`);
