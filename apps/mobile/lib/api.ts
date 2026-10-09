/**
 * API base URL for talking to @trace/website.
 * Never import website or scanner packages from mobile.
 */
export function getApiBaseUrl(): string {
  const base = process.env.EXPO_PUBLIC_API_URL;
  if (!base) {
    throw new Error("EXPO_PUBLIC_API_URL is not configured");
  }
  return base.replace(/\/$/, "");
}

export function apiUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${getApiBaseUrl()}${normalized}`;
}
