"use client";

import { useActionState } from "react";
import { Bell, Lock, LogOut, Mail, Trash2, User } from "lucide-react";
import { useTranslations } from "next-intl";

import { SeletorCidade } from "@/components/formulario/cidade-combobox";
import { botaoPrimario, botaoSecundario, campoInput, cartao } from "@/lib/estilos";

import {
  alterarSenha,
  atualizarPerfil,
  atualizarPreferenciasNotificacao,
  encerrarSessoes,
  excluirConta,
  reenviarVerificacaoEmail,
  solicitarTrocaEmail,
} from "./actions";

function Rotulo({ children, htmlFor }: { children: string; htmlFor: string }) {
  return (
    <label
      htmlFor={htmlFor}
      className="text-sm font-medium text-ink-2"
    >
      {children}
    </label>
  );
}

export function BotaoReenviarVerificacao() {
  const t = useTranslations("Conta");
  const [state, action, pending] = useActionState(reenviarVerificacaoEmail, undefined);

  return (
    <form action={action} className="flex flex-col items-start gap-2">
      <button type="submit" disabled={pending} className={botaoSecundario}>
        {t("reenviarVerificacao")}
      </button>
      {state?.mensagem && (
        <p role="status" className="text-sm text-ink-muted">
          {state.mensagem}
        </p>
      )}
    </form>
  );
}

export function BotaoEncerrarSessoes() {
  const t = useTranslations("Conta");

  return (
    <form action={encerrarSessoes}>
      <button type="submit" className={botaoSecundario}>
        <LogOut className="h-4 w-4" aria-hidden />
        {t("encerrarSessoes")}
      </button>
    </form>
  );
}

export function FormularioPerfil({
  telefone,
  cidadePadrao,
}: {
  telefone: string;
  cidadePadrao: { id: string; nome: string; uf: string } | null;
}) {
  const t = useTranslations("Conta");
  const [state, action, pending] = useActionState(atualizarPerfil, undefined);

  return (
    <form action={action} className={`flex flex-col gap-3 ${cartao}`}>
      <div className="flex items-center gap-2">
        <User className="h-5 w-5 text-ink-muted" aria-hidden />
        <h2 className="font-semibold text-ink">{t("dadosPessoais")}</h2>
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
          <p className="text-sm text-danger-ink">{state.erros.telefone[0]}</p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <Rotulo htmlFor="perfil-cidade">{t("cidadePadrao")}</Rotulo>
        <SeletorCidade
          id="perfil-cidade"
          placeholder={t("cidadePadrao")}
          defaultValue={cidadePadrao}
        />
        <p className="text-xs text-ink-muted">{t("cidadePadraoDesc")}</p>
        {state?.erros?.cidadeId && (
          <p className="text-sm text-danger-ink">{state.erros.cidadeId[0]}</p>
        )}
      </div>

      {state?.mensagem && (
        <p className="text-sm text-ink-muted">{state.mensagem}</p>
      )}

      <button type="submit" disabled={pending} className={`${botaoPrimario} w-fit`}>
        {t("salvarDados")}
      </button>
    </form>
  );
}

export function FormularioPreferenciasNotificacao({ notificarPorEmail }: { notificarPorEmail: boolean }) {
  const t = useTranslations("Conta");
  const [state, action, pending] = useActionState(atualizarPreferenciasNotificacao, undefined);

  return (
    <form action={action} className={`flex flex-col gap-3 ${cartao}`}>
      <div className="flex items-center gap-2">
        <Bell className="h-5 w-5 text-ink-muted" aria-hidden />
        <h2 className="font-semibold text-ink">
          {t("preferenciasNotificacao")}
        </h2>
      </div>

      <label className="flex items-start gap-2 text-sm text-ink-2">
        <input
          type="checkbox"
          name="notificarPorEmail"
          defaultChecked={notificarPorEmail}
          className="mt-0.5"
        />
        <span>{t("notificarPorEmailDesc")}</span>
      </label>

      {state?.mensagem && (
        <p className="text-sm text-ink-muted">{state.mensagem}</p>
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
        <Lock className="h-5 w-5 text-ink-muted" aria-hidden />
        <h2 className="font-semibold text-ink">{t("alterarSenha")}</h2>
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
          <p className="text-sm text-danger-ink">{state.erros.senhaAtual[0]}</p>
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
          <p className="text-sm text-danger-ink">{state.erros.novaSenha[0]}</p>
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
          <p className="text-sm text-danger-ink">
            {state.erros.confirmarNovaSenha[0]}
          </p>
        )}
      </div>

      {state?.mensagem && (
        <p className="text-sm text-ink-muted">{state.mensagem}</p>
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
        <Mail className="h-5 w-5 text-ink-muted" aria-hidden />
        <h2 className="font-semibold text-ink">{t("trocarEmail")}</h2>
      </div>
      <p className="text-sm text-ink-muted">
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
          <p className="text-sm text-danger-ink">{state.erros.novoEmail[0]}</p>
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
          <p className="text-sm text-danger-ink">{state.erros.senhaAtual[0]}</p>
        )}
      </div>

      {state?.mensagem && (
        <p className="text-sm text-ink-muted">{state.mensagem}</p>
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
      className="flex flex-col gap-3 rounded-lg border border-danger-ink/30 bg-danger-soft/50 p-4"
    >
      <div className="flex items-center gap-2">
        <Trash2 className="h-5 w-5 text-danger-ink" aria-hidden />
        <h2 className="font-semibold text-danger-ink">{t("excluirConta")}</h2>
      </div>
      <p className="text-sm text-danger-ink">{t("excluirContaDesc")}</p>

      <div className="flex flex-col gap-1">
        <Rotulo htmlFor="exclusao-senha">{t("confirmeSuaSenha")}</Rotulo>
        <input
          id="exclusao-senha"
          type="password"
          name="senhaAtual"
          className={campoInput}
        />
        {state?.erros?.senhaAtual && (
          <p className="text-sm text-danger-ink">{state.erros.senhaAtual[0]}</p>
        )}
      </div>
      {state?.mensagem && (
        <p className="text-sm text-danger-ink">{state.mensagem}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded-md bg-danger px-4 py-2.5 text-sm font-semibold text-on-danger transition hover:brightness-90 active:translate-y-px disabled:opacity-50 disabled:active:translate-y-0"
      >
        {t("excluirMinhaConta")}
      </button>
    </form>
  );
}
