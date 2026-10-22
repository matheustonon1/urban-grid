import { getTranslations } from "next-intl/server";

import { prisma } from "@/lib/prisma";
import { containerPagina, rotuloSecao } from "@/lib/estilos";
import {
  decifrarSegredoTotp,
  gerarQrCodeTotp,
  gerarUriTotp,
  QUANTIDADE_CODIGOS_BACKUP,
} from "@/lib/seguranca/totp";
import { iniciaisDoNome } from "@/lib/util/texto";
import { exigirSessao } from "@/lib/seguranca/sessao";
import { metadataDaPagina } from "@/lib/metadata";

import {
  FormularioExclusao,
  FormularioPerfil,
  FormularioPreferenciasNotificacao,
  FormularioSenha,
  FormularioTrocaEmail,
} from "./formularios";
import { ExportarDados } from "./exportar-dados";
import { ResumoSeguranca } from "./resumo-seguranca";
import { FormularioTotp } from "./totp-formulario";

export const generateMetadata = metadataDaPagina("Conta");

const SECOES = [
  { id: "perfil", chave: "secaoPerfil", perigo: false },
  { id: "seguranca", chave: "secaoSeguranca", perigo: false },
  { id: "dados", chave: "secaoDados", perigo: false },
  { id: "excluir", chave: "secaoExcluir", perigo: true },
] as const;

// Agrupa os cartões de uma seção sob um rótulo, com o id que a navegação
// aponta. scroll-mt compensa o cabeçalho fixo ao pular pela âncora.
function Grupo({ id, titulo, children }: { id: string; titulo: string; children: React.ReactNode }) {
  return (
    <div id={id} role="group" aria-labelledby={`${id}-titulo`} className="flex scroll-mt-24 flex-col gap-4">
      <p id={`${id}-titulo`} className={rotuloSecao}>
        {titulo}
      </p>
      {children}
    </div>
  );
}

export default async function ContaPage() {
  const t = await getTranslations("Conta");
  const tPapel = await getTranslations("Papel");
  const session = await exigirSessao();

  const usuario = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: {
      name: true,
      email: true,
      telefone: true,
      totpSecret: true,
      totpConfirmadoEm: true,
      notificarPorEmail: true,
      emailVerified: true,
      createdAt: true,
      cidade: { select: { id: true, nome: true, estado: { select: { uf: true } } } },
    },
  });

  const totpAtivo = !!usuario.totpConfirmadoEm;
  const codigosRestantes = totpAtivo
    ? await prisma.totpBackupCode.count({ where: { userId: session.user.id, usadoEm: null } })
    : 0;

  const pendente = !!usuario.totpSecret && !usuario.totpConfirmadoEm;
  let qrCodeDataUrl: string | undefined;
  let segredoManual: string | undefined;
  if (pendente && usuario.totpSecret) {
    segredoManual = decifrarSegredoTotp(usuario.totpSecret);
    qrCodeDataUrl = await gerarQrCodeTotp(gerarUriTotp(usuario.email, segredoManual));
  }

  const nomeExibido = usuario.name || usuario.email;

  return (
    <main className={`${containerPagina} max-w-4xl`}>
      <div className="flex items-center gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-blue-600 to-blue-500 text-lg font-semibold text-white shadow-lg shadow-blue-600/20 dark:from-blue-500 dark:to-blue-400 dark:shadow-blue-500/15">
          {iniciaisDoNome(nomeExibido)}
        </span>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {usuario.name || t("titulo")}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm text-slate-500 dark:text-slate-400">{usuario.email}</p>
            <span className="inline-block w-fit rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {tPapel(session.user.papel)}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[12rem_minmax(0,1fr)] lg:items-start">
        {/* Navegação por seções: coluna fixa no desktop, faixa rolável no celular.
            São âncoras simples (sem JS): cada grupo abaixo tem o id correspondente. */}
        <nav aria-label={t("navegacaoSecoes")} className="min-w-0 lg:sticky lg:top-20">
          <ul className="-mx-6 flex gap-1.5 overflow-x-auto px-6 pb-1 sm:-mx-8 sm:px-8 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
            {SECOES.map(({ id, chave, perigo }) => (
              <li key={id} className="shrink-0">
                <a
                  href={`#${id}`}
                  className={`block rounded-full px-3 py-1.5 text-sm font-medium transition-colors lg:rounded-lg ${
                    perigo
                      ? "text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                  }`}
                >
                  {t(chave)}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex min-w-0 flex-col gap-10">
          <Grupo id="perfil" titulo={t("secaoPerfil")}>
            <FormularioPerfil
              telefone={usuario.telefone ?? ""}
              cidadePadrao={
                usuario.cidade
                  ? { id: usuario.cidade.id, nome: usuario.cidade.nome, uf: usuario.cidade.estado.uf }
                  : null
              }
            />
            <FormularioPreferenciasNotificacao notificarPorEmail={usuario.notificarPorEmail} />
          </Grupo>

          <Grupo id="seguranca" titulo={t("secaoSeguranca")}>
            <ResumoSeguranca
              totpAtivo={totpAtivo}
              emailVerificado={!!usuario.emailVerified}
              criadoEm={usuario.createdAt}
            />
            <FormularioSenha />
            <FormularioTrocaEmail emailAtual={usuario.email} />
            <FormularioTotp
              ativo={totpAtivo}
              pendente={pendente}
              qrCodeDataUrl={qrCodeDataUrl}
              segredoManual={segredoManual}
              codigosRestantes={codigosRestantes}
              codigosTotal={QUANTIDADE_CODIGOS_BACKUP}
            />
          </Grupo>

          <Grupo id="dados" titulo={t("secaoDados")}>
            <ExportarDados />
          </Grupo>

          <Grupo id="excluir" titulo={t("secaoExcluir")}>
            <FormularioExclusao />
          </Grupo>
        </div>
      </div>
    </main>
  );
}
