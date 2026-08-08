// Auth utilities — JWT removed; Clerk session cookie handles auth for web automatically.
// authFetch is a plain fetch wrapper; same-origin Clerk cookies are sent by the browser.

export const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

export async function authFetch(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  return fetch(url, options);
}
