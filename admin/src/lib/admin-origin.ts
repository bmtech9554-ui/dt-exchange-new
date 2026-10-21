/** Validate against a server-configured origin, never client-supplied proxy headers. */
export function isAllowedAdminOrigin(request: Request, configuredOrigin: string | undefined, production: boolean): boolean {
  try {
    if (production && !configuredOrigin) return false;
    const allowed = new URL(configuredOrigin ?? request.url);
    if (configuredOrigin && (allowed.username || allowed.password || allowed.search || allowed.hash || allowed.pathname !== '/')) return false;
    if (production && allowed.protocol !== 'https:') return false;
    return request.headers.get('origin') === allowed.origin;
  } catch {
    return false;
  }
}
