import type { ReactNode } from "react";
import { CircleAlert } from "lucide-react";

export function idDica(id: string) {
  return `${id}-dica`;
}

export function idErro(id: string) {
  return `${id}-erro`;
}

// O que o campo aponta em aria-describedby: o erro, se houver, senão a dica.
export function descritoPor(id: string, erro?: string, dica?: string) {
  return erro ? idErro(id) : dica ? idDica(id) : undefined;
}

// Mensagem de erro de um campo: ícone + texto (a cor sozinha não basta) e
// role="alert", pra o leitor de tela anunciar quando ela aparece.
export function MensagemErro({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p
      id={idErro(id)}
      role="alert"
      className="flex items-start gap-1.5 text-sm text-red-700 dark:text-red-400"
    >
      <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

// Rótulo visível acima do campo (o placeholder some ao digitar e não serve de
// rótulo), contador opcional à direita e, embaixo, o erro OU a dica - nunca os
// dois, pra o espaço não crescer a cada tentativa de envio.
export function Campo({
  id,
  rotulo,
  opcional,
  dica,
  erro,
  contador,
  children,
}: {
  id: string;
  rotulo: string;
  opcional?: string;
  dica?: ReactNode;
  erro?: string;
  contador?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-slate-800 dark:text-slate-200">
          {rotulo}
          {opcional && (
            <span className="ml-1.5 font-normal text-slate-500 dark:text-slate-400">({opcional})</span>
          )}
        </label>
        {contador}
      </div>
      {children}
      {erro ? (
        <MensagemErro id={id}>{erro}</MensagemErro>
      ) : dica ? (
        <p id={idDica(id)} className="text-xs text-slate-500 dark:text-slate-400">
          {dica}
        </p>
      ) : null}
    </div>
  );
}
