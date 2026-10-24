import { getTranslations } from "next-intl/server";

import { prisma } from "@/lib/prisma";
import { Secao } from "@/components/ui/secao";
import { grade, pagina } from "@/lib/estilos";
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
    <main className={pagina}>
      <header className="flex items-center gap-5 border-b-2 border-ink pb-6">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-brand text-xl font-bold text-on-brand">
          {iniciaisDoNome(nomeExibido)}
        </span>
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="kicker">{t("kicker")}</span>
          <h1 className="text-3xl leading-tight font-extrabold tracking-tight text-ink sm:text-4xl">
            {usuario.name || t("titulo")}
          </h1>
          <div className="flex flex-wrap items-center gap-2.5">
            <p className="text-ink-muted">{usuario.email}</p>
            <span className="inline-block rounded-[5px] bg-sunken px-2 py-0.5 text-xs font-semibold text-ink-2">
              {tPapel(session.user.papel)}
            </span>
          </div>
        </div>
      </header>

      <div className={grade}>
        {/* Navegação por seções: coluna fixa no desktop, faixa rolável no celular.
            São âncoras simples (sem JS): cada seção abaixo tem o id correspondente. */}
        <nav aria-label={t("navegacaoSecoes")} className="min-w-0 lg:sticky lg:top-24 lg:col-span-3">
          <ul className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:-mx-8 sm:px-8 lg:mx-0 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:px-0 lg:pb-0">
            {SECOES.map(({ id, chave, perigo }) => (
              <li key={id} className="shrink-0">
                <a
                  href={`#${id}`}
                  className={`block rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
                    perigo
                      ? "text-danger-ink hover:bg-danger-soft"
                      : "text-ink-muted hover:bg-sunken hover:text-ink"
                  }`}
                >
                  {t(chave)}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex min-w-0 flex-col gap-12 lg:col-span-9 lg:max-w-3xl">
          <Secao id="perfil" titulo={t("secaoPerfil")}>
            <FormularioPerfil
              telefone={usuario.telefone ?? ""}
              cidadePadrao={
                usuario.cidade
                  ? { id: usuario.cidade.id, nome: usuario.cidade.nome, uf: usuario.cidade.estado.uf }
                  : null
              }
            />
            <FormularioPreferenciasNotificacao notificarPorEmail={usuario.notificarPorEmail} />
          </Secao>

          <Secao id="seguranca" titulo={t("secaoSeguranca")}>
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
          </Secao>

          <Secao id="dados" titulo={t("secaoDados")}>
            <ExportarDados />
          </Secao>

          <Secao id="excluir" titulo={t("secaoExcluir")}>
            <FormularioExclusao />
          </Secao>
        </div>
      </div>
    </main>
  );
}
