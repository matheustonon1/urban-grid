export function urlBase(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export function montarUrl(caminho: string): string {
  return `${urlBase()}${caminho}`;
}
