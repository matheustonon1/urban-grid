"use server";

import { cookies } from "next/headers";

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
}
