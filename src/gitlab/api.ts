import type { GitLabConfig } from "../config";
import { AuthRequiredError, getAccessToken } from "./oauth";

export interface GitLabUser {
  id: number;
  username: string;
  name: string;
  avatar_url?: string | null;
  web_url?: string;
}

export interface GitLabMember {
  id: number;
  username: string;
  name: string;
  avatar_url?: string | null;
  access_level?: number;
}

export interface GitLabLabel {
  id?: number;
  name: string;
  color?: string;
}

export interface GitLabIssue {
  id: number;
  iid: number;
  title: string;
  description: string | null;
  state: "opened" | "closed";
  labels: string[];
  due_date: string | null;
  assignees?: Array<{ id: number; name: string; username: string }>;
  created_at: string;
  updated_at: string;
  web_url?: string;
}

export class GitLabApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "GitLabApiError";
    this.status = status;
  }
}

async function errorMessage(response: Response): Promise<string> {
  try {
    const data = await response.json();
    if (typeof data?.message === "string") return data.message;
    if (typeof data?.error === "string") return data.error;
    return JSON.stringify(data).slice(0, 300);
  } catch {
    return response.statusText || `HTTP ${response.status}`;
  }
}

export class GitLabApi {
  private readonly base: string;

  constructor(private readonly config: GitLabConfig) {
    this.base = config.gitlabBaseUrl.replace(/\/+$/, "");
  }

  private async raw(path: string, init: RequestInit = {}, retry = true): Promise<Response> {
    const token = await getAccessToken(this.config);
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token}`);
    if (init.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    const response = await fetch(`${this.base}/api/v4${path}`, { ...init, headers });
    if (response.status === 401 && retry) {
      await getAccessToken(this.config, true);
      return this.raw(path, init, false);
    }
    return response;
  }

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await this.raw(path, init);
    if (!response.ok) {
      if (response.status === 401) throw new AuthRequiredError();
      throw new GitLabApiError(response.status, await errorMessage(response));
    }
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  private async requestWithHeaders<T>(
    path: string,
    init: RequestInit = {},
  ): Promise<{ data: T; headers: Headers }> {
    const response = await this.raw(path, init);
    if (!response.ok) {
      if (response.status === 401) throw new AuthRequiredError();
      throw new GitLabApiError(response.status, await errorMessage(response));
    }
    return { data: (await response.json()) as T, headers: response.headers };
  }

  getCurrentUser(): Promise<GitLabUser> {
    return this.request<GitLabUser>("/user");
  }

  getProject(): Promise<{ id: number; path_with_namespace: string }> {
    return this.request(`/projects/${this.config.projectId}`);
  }

  async listMembers(): Promise<GitLabMember[]> {
    const all: GitLabMember[] = [];
    let page = 1;
    while (page <= 10) {
      const { data, headers } = await this.requestWithHeaders<GitLabMember[]>(
        `/projects/${this.config.projectId}/members/all?per_page=100&page=${page}`,
      );
      all.push(...data);
      const next = headers.get("x-next-page");
      if (!next) break;
      page = Number(next);
    }
    return all;
  }

  async listIssues(): Promise<GitLabIssue[]> {
    const all: GitLabIssue[] = [];
    let page = 1;
    while (page <= 20) {
      const { data, headers } = await this.requestWithHeaders<GitLabIssue[]>(
        `/projects/${this.config.projectId}/issues?state=all&per_page=100&page=${page}&order_by=created_at&sort=asc`,
      );
      all.push(...data);
      const next = headers.get("x-next-page");
      if (!next) break;
      page = Number(next);
    }
    return all;
  }

  async createIssue(payload: Record<string, unknown>): Promise<GitLabIssue> {
    return this.request<GitLabIssue>(`/projects/${this.config.projectId}/issues`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async updateIssue(iid: number, payload: Record<string, unknown>): Promise<GitLabIssue> {
    return this.request<GitLabIssue>(`/projects/${this.config.projectId}/issues/${iid}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  }

  async deleteIssue(iid: number): Promise<void> {
    await this.request<void>(`/projects/${this.config.projectId}/issues/${iid}`, {
      method: "DELETE",
    });
  }

  async listLabels(): Promise<GitLabLabel[]> {
    const all: GitLabLabel[] = [];
    let page = 1;
    while (page <= 10) {
      const { data, headers } = await this.requestWithHeaders<GitLabLabel[]>(
        `/projects/${this.config.projectId}/labels?per_page=100&page=${page}`,
      );
      all.push(...data);
      const next = headers.get("x-next-page");
      if (!next) break;
      page = Number(next);
    }
    return all;
  }

  async createLabel(name: string, color: string): Promise<void> {
    const response = await this.raw(`/projects/${this.config.projectId}/labels`, {
      method: "POST",
      body: JSON.stringify({ name, color }),
    });
    if (response.ok || response.status === 409) return;
    const message = await errorMessage(response);
    if (/already exists|已存在/i.test(message)) return;
    throw new GitLabApiError(response.status, message);
  }
}
