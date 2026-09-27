"use server";

import { cookies } from "next/headers";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

import { COOKIE_IDIOMA, IDIOMAS, type Idioma } from "./config";

export async function definirIdioma(idioma: Idioma) {
  if (!(IDIOMAS as readonly string[]).includes(idioma)) {
    return;
  }

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_IDIOMA, idioma, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  // Persiste pra quem está logado - o cookie só vale nesta navegação/
  // dispositivo, mas os e-mails transacionais (moderação, resposta
  // oficial etc.) são disparados por outra pessoa, sem esse cookie à
  // mão. Sem isso, a pessoa trocaria o idioma da tela sem nunca ver
  // reflexo nos e-mails que recebe.
  const session = await auth();
  if (session?.user) {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { idioma },
    });
  }
}
