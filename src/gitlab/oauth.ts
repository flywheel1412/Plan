import type { GitLabConfig } from "../config";

export interface OAuthTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number;
}

export interface GitLabUser {
  id: number;
  username: string;
  name: string;
  avatarUrl?: string;
  webUrl?: string;
}

const TOKEN_KEY = "plan-kanban.oauth.tokens.v1";
const PKCE_KEY = "plan-kanban.oauth.pkce.v1";
const EXPIRY_SKEW_MS = 60_000;

export class AuthRequiredError extends Error {
  constructor() {
    super("需要重新登录 GitLab");
    this.name = "AuthRequiredError";
  }
}

function readTokens(): OAuthTokens | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OAuthTokens;
    if (!parsed || typeof parsed.accessToken !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeTokens(tokens: OAuthTokens) {
  localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
}

export function clearTokens() {
  localStorage.removeItem(TOKEN_KEY);
}

export function hasTokens(): boolean {
  return !!readTokens();
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomString(byteLength: number): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(byteLength)));
}

async function sha256(value: string): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return new Uint8Array(digest);
}

function cleanOAuthQuery() {
  const url = new URL(window.location.href);
  ["code", "state", "error", "error_description"].forEach((key) =>
    url.searchParams.delete(key),
  );
  const query = url.searchParams.toString();
  window.history.replaceState(
    {},
    document.title,
    `${url.pathname}${query ? `?${query}` : ""}${url.hash}`,
  );
}

export async function beginLogin(config: GitLabConfig) {
  const verifier = randomString(32);
  const challenge = base64Url(await sha256(verifier));
  const state = randomString(16);
  sessionStorage.setItem(
    PKCE_KEY,
    JSON.stringify({ verifier, state, redirectUri: config.redirectUri }),
  );
  const params = new URLSearchParams({
    client_id: config.oauthClientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: "api",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  window.location.assign(`${config.gitlabBaseUrl}/oauth/authorize?${params.toString()}`);
}

/** Handles the OAuth redirect. Returns true when a callback was processed. */
export async function completeOAuthCallback(config: GitLabConfig): Promise<boolean> {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const error = params.get("error");
  const state = params.get("state");
  if (!code && !error) return false;

  const rawPkce = sessionStorage.getItem(PKCE_KEY);
  sessionStorage.removeItem(PKCE_KEY);

  if (error) {
    cleanOAuthQuery();
    throw new Error(params.get("error_description") || error);
  }
  if (!rawPkce) {
    cleanOAuthQuery();
    throw new Error("登录会话已过期，请重新登录");
  }
  let pkce: { verifier: string; state: string; redirectUri: string };
  try {
    pkce = JSON.parse(rawPkce);
  } catch {
    cleanOAuthQuery();
    throw new Error("登录会话无效，请重新登录");
  }
  if (!state || state !== pkce.state) {
    cleanOAuthQuery();
    throw new Error("登录状态校验失败，请重新登录");
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: code as string,
    client_id: config.oauthClientId,
    redirect_uri: pkce.redirectUri,
    code_verifier: pkce.verifier,
  });
  const response = await fetch(`${config.gitlabBaseUrl}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  cleanOAuthQuery();
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`GitLab 登录失败（${response.status}）${detail.slice(0, 200)}`);
  }
  const data = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };
  writeTokens({
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresAt: Date.now() + (data.expires_in ?? 7200) * 1000,
  });
  return true;
}

let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(config: GitLabConfig, refreshToken: string): Promise<string> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: config.oauthClientId,
    redirect_uri: config.redirectUri,
  });
  const response = await fetch(`${config.gitlabBaseUrl}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) {
    clearTokens();
    throw new AuthRequiredError();
  }
  const data = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };
  const tokens: OAuthTokens = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? refreshToken,
    expiresAt: Date.now() + (data.expires_in ?? 7200) * 1000,
  };
  writeTokens(tokens);
  return tokens.accessToken;
}

export async function getAccessToken(
  config: GitLabConfig,
  forceRefresh = false,
): Promise<string> {
  const tokens = readTokens();
  if (!tokens) throw new AuthRequiredError();
  if (!forceRefresh && tokens.expiresAt - EXPIRY_SKEW_MS > Date.now()) {
    return tokens.accessToken;
  }
  if (!tokens.refreshToken) {
    clearTokens();
    throw new AuthRequiredError();
  }
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken(config, tokens.refreshToken).finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export async function revokeTokens(config: GitLabConfig) {
  const tokens = readTokens();
  if (!tokens) return;
  try {
    await fetch(`${config.gitlabBaseUrl}/oauth/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.oauthClientId,
        token: tokens.accessToken,
      }),
    });
  } catch {
    /* best effort */
  } finally {
    clearTokens();
  }
}
