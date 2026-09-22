import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { containerPagina } from "@/lib/estilos";
import { decifrarSegredoTotp, gerarQrCodeTotp, gerarUriTotp } from "@/lib/totp";
import { iniciaisDoNome } from "@/lib/texto";

import {
  FormularioExclusao,
  FormularioPerfil,
  FormularioSenha,
  FormularioTrocaEmail,
} from "./formularios";
import { FormularioTotp } from "./totp-formulario";

const PAPEL_LABEL: Record<string, string> = {
  CIDADAO: "Cidadão",
  MODERADOR: "Moderador",
  ADMIN: "Administrador",
  ORGAO: "Órgão público",
};

export default async function ContaPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const usuario = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: {
      name: true,
      email: true,
      telefone: true,
      totpSecret: true,
      totpConfirmadoEm: true,
    },
  });

  const pendente = !!usuario.totpSecret && !usuario.totpConfirmadoEm;
  let qrCodeDataUrl: string | undefined;
  let segredoManual: string | undefined;
  if (pendente && usuario.totpSecret) {
    segredoManual = decifrarSegredoTotp(usuario.totpSecret);
    qrCodeDataUrl = await gerarQrCodeTotp(gerarUriTotp(usuario.email, segredoManual));
  }

  const nomeExibido = usuario.name || usuario.email;

  return (
    <main className={`${containerPagina} max-w-xl`}>
      <div className="flex items-center gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-blue-600 to-blue-500 text-lg font-semibold text-white shadow-lg shadow-blue-600/20 dark:from-blue-500 dark:to-blue-400 dark:shadow-blue-500/15">
          {iniciaisDoNome(nomeExibido)}
        </span>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {usuario.name || "Minha conta"}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm text-slate-500 dark:text-slate-400">{usuario.email}</p>
            <span className="inline-block w-fit rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {PAPEL_LABEL[session.user.papel] ?? session.user.papel}
            </span>
          </div>
        </div>
      </div>

      <FormularioPerfil telefone={usuario.telefone ?? ""} />
      <FormularioSenha />
      <FormularioTrocaEmail emailAtual={usuario.email} />
      <FormularioTotp
        ativo={!!usuario.totpConfirmadoEm}
        pendente={pendente}
        qrCodeDataUrl={qrCodeDataUrl}
        segredoManual={segredoManual}
      />
      <FormularioExclusao />
    </main>
  );
}
