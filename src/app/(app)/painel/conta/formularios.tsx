"use client";

import { useActionState } from "react";
import { Lock, Mail, Trash2, User } from "lucide-react";
import { useTranslations } from "next-intl";

import { botaoPrimario, campoInput, cartao } from "@/lib/estilos";

import { alterarSenha, atualizarPerfil, excluirConta, solicitarTrocaEmail } from "./actions";

function Rotulo({ children, htmlFor }: { children: string; htmlFor: string }) {
  return (
    <label
      htmlFor={htmlFor}
      className="text-sm font-medium text-slate-700 dark:text-slate-300"
    >
      {children}
    </label>
  );
}

export function FormularioPerfil({ telefone }: { telefone: string }) {
  const t = useTranslations("Conta");
  const [state, action, pending] = useActionState(atualizarPerfil, undefined);

  return (
    <form action={action} className={`flex flex-col gap-3 ${cartao}`}>
      <div className="flex items-center gap-2">
        <User className="h-5 w-5 text-slate-400 dark:text-slate-500" aria-hidden />
        <h2 className="font-semibold text-slate-900 dark:text-slate-100">{t("dadosPessoais")}</h2>
      </div>

      <div className="flex flex-col gap-1">
        <Rotulo htmlFor="perfil-telefone">{t("telefone")}</Rotulo>
        <input
          id="perfil-telefone"
          type="tel"
          name="telefone"
          defaultValue={telefone}
          placeholder={t("opcional")}
          className={campoInput}
        />
        {state?.erros?.telefone && (
          <p className="text-sm text-red-600 dark:text-red-400">{state.erros.telefone[0]}</p>
        )}
      </div>

      {state?.mensagem && (
        <p className="text-sm text-slate-600 dark:text-slate-400">{state.mensagem}</p>
      )}

      <button type="submit" disabled={pending} className={`${botaoPrimario} w-fit`}>
        {t("salvarDados")}
      </button>
    </form>
  );
}

export function FormularioSenha() {
  const t = useTranslations("Conta");
  const [state, action, pending] = useActionState(alterarSenha, undefined);

  return (
    <form action={action} className={`flex flex-col gap-3 ${cartao}`}>
      <div className="flex items-center gap-2">
        <Lock className="h-5 w-5 text-slate-400 dark:text-slate-500" aria-hidden />
        <h2 className="font-semibold text-slate-900 dark:text-slate-100">{t("alterarSenha")}</h2>
      </div>

      <div className="flex flex-col gap-1">
        <Rotulo htmlFor="senha-atual">{t("senhaAtual")}</Rotulo>
        <input
          id="senha-atual"
          type="password"
          name="senhaAtual"
          className={campoInput}
        />
        {state?.erros?.senhaAtual && (
          <p className="text-sm text-red-600 dark:text-red-400">{state.erros.senhaAtual[0]}</p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <Rotulo htmlFor="senha-nova">{t("novaSenha")}</Rotulo>
        <input
          id="senha-nova"
          type="password"
          name="novaSenha"
          placeholder={t("minimoCaracteres")}
          className={campoInput}
        />
        {state?.erros?.novaSenha && (
          <p className="text-sm text-red-600 dark:text-red-400">{state.erros.novaSenha[0]}</p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <Rotulo htmlFor="senha-confirmar">{t("confirmarNovaSenha")}</Rotulo>
        <input
          id="senha-confirmar"
          type="password"
          name="confirmarNovaSenha"
          className={campoInput}
        />
        {state?.erros?.confirmarNovaSenha && (
          <p className="text-sm text-red-600 dark:text-red-400">
            {state.erros.confirmarNovaSenha[0]}
          </p>
        )}
      </div>

      {state?.mensagem && (
        <p className="text-sm text-slate-600 dark:text-slate-400">{state.mensagem}</p>
      )}

      <button type="submit" disabled={pending} className={`${botaoPrimario} w-fit`}>
        {t("alterarSenha")}
      </button>
    </form>
  );
}

export function FormularioTrocaEmail({ emailAtual }: { emailAtual: string }) {
  const t = useTranslations("Conta");
  const [state, action, pending] = useActionState(solicitarTrocaEmail, undefined);

  return (
    <form action={action} className={`flex flex-col gap-3 ${cartao}`}>
      <div className="flex items-center gap-2">
        <Mail className="h-5 w-5 text-slate-400 dark:text-slate-500" aria-hidden />
        <h2 className="font-semibold text-slate-900 dark:text-slate-100">{t("trocarEmail")}</h2>
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        {t("emailAtual")} <span className="font-medium">{emailAtual}</span>. {t("trocaEmailDesc")}
      </p>

      <div className="flex flex-col gap-1">
        <Rotulo htmlFor="email-novo">{t("novoEmail")}</Rotulo>
        <input
          id="email-novo"
          type="email"
          name="novoEmail"
          className={campoInput}
        />
        {state?.erros?.novoEmail && (
          <p className="text-sm text-red-600 dark:text-red-400">{state.erros.novoEmail[0]}</p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <Rotulo htmlFor="email-senha-atual">{t("confirmeSuaSenha")}</Rotulo>
        <input
          id="email-senha-atual"
          type="password"
          name="senhaAtual"
          className={campoInput}
        />
        {state?.erros?.senhaAtual && (
          <p className="text-sm text-red-600 dark:text-red-400">{state.erros.senhaAtual[0]}</p>
        )}
      </div>

      {state?.mensagem && (
        <p className="text-sm text-slate-600 dark:text-slate-400">{state.mensagem}</p>
      )}

      <button type="submit" disabled={pending} className={`${botaoPrimario} w-fit`}>
        {t("enviarLinkConfirmacao")}
      </button>
    </form>
  );
}

export function FormularioExclusao() {
  const t = useTranslations("Conta");
  const [state, action, pending] = useActionState(excluirConta, undefined);

  return (
    <form
      action={action}
      className="flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50/50 p-4 dark:border-red-900 dark:bg-red-950/30"
    >
      <div className="flex items-center gap-2">
        <Trash2 className="h-5 w-5 text-red-600 dark:text-red-400" aria-hidden />
        <h2 className="font-semibold text-red-800 dark:text-red-400">{t("excluirConta")}</h2>
      </div>
      <p className="text-sm text-red-700 dark:text-red-400">{t("excluirContaDesc")}</p>

      <div className="flex flex-col gap-1">
        <Rotulo htmlFor="exclusao-senha">{t("confirmeSuaSenha")}</Rotulo>
        <input
          id="exclusao-senha"
          type="password"
          name="senhaAtual"
          className={campoInput}
        />
        {state?.erros?.senhaAtual && (
          <p className="text-sm text-red-600 dark:text-red-400">{state.erros.senhaAtual[0]}</p>
        )}
      </div>
      {state?.mensagem && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.mensagem}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-800 active:scale-95 disabled:opacity-50 disabled:active:scale-100 dark:bg-red-600 dark:hover:bg-red-500"
      >
        {t("excluirMinhaConta")}
      </button>
    </form>
  );
}
