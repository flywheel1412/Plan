export type LocalConfig = {
  mode: "local";
};

export type GitLabConfig = {
  mode: "gitlab";
  gitlabBaseUrl: string;
  projectId: number;
  oauthClientId: string;
  redirectUri: string;
};

export type RuntimeConfig = LocalConfig | GitLabConfig;

const LOCAL_CONFIG: LocalConfig = { mode: "local" };

export async function loadRuntimeConfig(): Promise<RuntimeConfig> {
  try {
    const response = await fetch("./config.json", { cache: "no-store" });
    if (!response.ok) return LOCAL_CONFIG;
    const data = (await response.json()) as Partial<GitLabConfig> & { mode?: string };
    if (
      data.mode === "gitlab" &&
      typeof data.gitlabBaseUrl === "string" &&
      typeof data.projectId === "number" &&
      typeof data.oauthClientId === "string"
    ) {
      const redirectUri =
        typeof data.redirectUri === "string" && data.redirectUri
          ? data.redirectUri
          : `${window.location.origin}${window.location.pathname}`;
      return {
        mode: "gitlab",
        gitlabBaseUrl: data.gitlabBaseUrl.replace(/\/+$/, ""),
        projectId: data.projectId,
        oauthClientId: data.oauthClientId,
        redirectUri,
      };
    }
  } catch {
    /* no config.json -> local mode */
  }
  return LOCAL_CONFIG;
}
