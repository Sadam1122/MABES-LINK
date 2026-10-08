/** Applies to mutating cookie-authenticated requests; never a replacement for RBAC. */
export function isAllowedRequestOrigin(
  request: Request,
  configuredUrl?: string,
) {
  const origin = request.headers.get("origin");
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  try {
    const allowed = new URL(configuredUrl ?? request.url).origin;
    return !origin || origin === allowed;
  } catch {
    return false;
  }
}
