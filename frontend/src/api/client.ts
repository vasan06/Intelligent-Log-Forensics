import type {
  Attack,
  AdminOverview,
  AdminUploadRow,
  AdminUser,
  GeneratorStatus,
  IncidentDetail,
  LabelF1,
  LogsFilterResult,
  Overview,
  TimelineItem,
  TopIp,
  UploadRow,
  User,
} from "./types";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const JSON_HEADERS: Record<string, string> = { Accept: "application/json" };
const UNSAFE = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function getCookie(name: string): string | null {
  const encoded = document.cookie.match(`(?:^|; )${name.replace(/([.$?*|{}()[\]\\/+^])/g, "\\$1")}=([^;]*)`);
  return encoded ? decodeURIComponent(encoded[1]) : null;
}

let refreshPromise: Promise<boolean> | null = null;

async function attemptRefresh(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  const csrf = getCookie("csrf_refresh_token");
  refreshPromise = fetch("/api/v1/auth/refresh", {
    method: "POST",
    headers: { "X-CSRF-TOKEN": csrf ?? "", Accept: "application/json" },
  })
    .then((res) => res.ok)
    .catch(() => false)
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

function withCsrf(init?: RequestInit): RequestInit {
  if (!init || !UNSAFE.has((init.method ?? "GET").toUpperCase())) return init ?? {};
  const csrf = getCookie("csrf_access_token");
  return { ...init, headers: { ...(init.headers as Record<string, string>), "X-CSRF-TOKEN": csrf ?? "" } };
}

async function request<T>(url: string, init?: RequestInit, _retried = false): Promise<T> {
  const res = await fetch(url, withCsrf(init));
  const contentType = res.headers.get("content-type") ?? "";

  if (res.status === 401 && !_retried && url.startsWith("/api/") && !url.includes("/auth/")) {
    if (await attemptRefresh()) return request<T>(url, init, true);
  }

  if (res.status === 302 || res.status === 401) {
    if (url.startsWith("/api/") && !contentType.includes("application/json")) {
      throw new ApiError("Not authenticated", 401);
    }
  }

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    if (contentType.includes("application/json")) {
      try {
        const body = (await res.json()) as { error?: string };
        if (body?.error) message = body.error;
      } catch {
        /* keep fallback */
      }
    }
    throw new ApiError(message, res.status);
  }

  if (res.status === 204) return undefined as T;
  if (contentType.includes("application/json")) return (await res.json()) as T;
  return (await res.text()) as unknown as T;
}

export const api = {
  me: () => request<User>("/api/v1/auth/me", { headers: JSON_HEADERS }),

  login: (email: string, password: string) =>
    request<{ user: User }>("/api/v1/auth/login", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    }),

  register: (name: string, email: string, password: string) =>
    request<{ user: User }>("/api/v1/auth/register", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    }),

  logout: () =>
    request<{ ok: boolean }>("/api/v1/auth/logout", {
      method: "POST",
      headers: JSON_HEADERS,
    }),

  config: () =>
    request<{ max_upload_mb: number; app_origin: string }>("/api/v1/config"),

  overview: () => request<Overview>("/api/v1/dashboard/overview"),
  riskDistribution: () => request<Record<string, number>>("/api/v1/dashboard/risk-distribution"),
  logSources: () => request<Record<string, number>>("/api/v1/dashboard/log-sources"),
  mitreStats: () => request<Record<string, number>>("/api/v1/dashboard/mitre-stats"),
  errorTrends: () =>
    request<{ labels: string[]; values: number[] }>("/api/v1/dashboard/error-trends"),
  topIps: (limit = 6) => request<TopIp[]>(`/api/v1/dashboard/top-risky-ips?limit=${limit}`),

  uploads: (limit = 100) => request<UploadRow[]>(`/api/v1/uploads?limit=${limit}`),
  uploadDetail: (id: number) => request<UploadRow>(`/api/v1/uploads/${id}`),
  uploadStatus: (id: number) =>
    request<{ status: string; total_records: number; error: string | null }>(
      `/api/v1/upload/status/${id}`,
    ),

  logs: (fileId: number, params: { q?: string; source?: string; status?: string }) => {
    const qs = new URLSearchParams({ file_id: String(fileId) });
    if (params.q) qs.set("q", params.q);
    if (params.source) qs.set("source_type", params.source);
    if (params.status) qs.set("status", params.status);
    return request<LogsFilterResult>(`/api/v1/logs/filter?${qs.toString()}`);
  },

  incidents: (fileId: number) =>
    request<{ file_name: string; incidents: IncidentDetail[] }>(`/api/v1/incidents/${fileId}`),
  timeline: (fileId: number) => request<TimelineItem[]>(`/api/v1/dashboard/timeline/${fileId}`),

  labelRisk: (riskId: number, label: string) =>
    request<{ id: number; label: string; reviewed_at: string | null }>(
      `/api/v1/risk-events/${riskId}/label`,
      {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      },
    ),

  labelsVsF1: () => request<LabelF1[]>("/api/v1/model/labels-vs-f1"),
  generatorStatus: () => request<GeneratorStatus>("/api/v1/generator/status"),  generatorStart: (mode: string) =>
    request<{ status: string; mode: string }>("/api/v1/generator/start", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    }),
  generatorStop: () =>
    request<{ status: string; error: string | null }>("/api/v1/generator/stop", {
      method: "POST",
      headers: JSON_HEADERS,
    }),

  attacks: () => request<Record<string, Attack>>("/api/v1/attacks"),

  adminOverview: () => request<AdminOverview>("/api/v1/admin/overview"),
  adminUsers: () => request<AdminUser[]>("/api/v1/admin/users"),
  adminUploads: (limit = 100) => request<AdminUploadRow[]>(`/api/v1/admin/uploads?limit=${limit}`),
  adminDatabase: () =>
    request<{ database: string; user: string; version: string }>("/api/v1/admin/database"),

  uploadFile: (file: File) => {
    const form = new FormData();
    form.append("log_file", file);
    return request<{ id: number; file_name: string; processing_status: string }>(
      "/api/v1/uploads",
      { method: "POST", body: form, headers: JSON_HEADERS },
    );
  },

  generateReport: (fileId: number) =>
    request<Blob>(`/reports/generate/${fileId}`, {
      method: "POST",
      headers: { Accept: "application/pdf" },
    }),
};

export function severityTone(severity: string | null | undefined): "ok" | "amber" | "danger" | "info" | "violet" {
  switch ((severity ?? "").toLowerCase()) {
    case "critical":
    case "high":
      return "danger";
    case "medium":
      return "amber";
    case "low":
      return "info";
    default:
      return "ok";
  }
}

export function statusTone(status: string | null | undefined): "ok" | "amber" | "danger" | "info" {
  switch ((status ?? "").toLowerCase()) {
    case "completed":
    case "completed with warnings":
    case "complete":
      return "ok";
    case "processing":
    case "parsing":
    case "analyzing":
    case "normalizing":
      return "amber";
    case "failed":
      return "danger";
    default:
      return "info";
  }
}

export function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[i]}`;
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatTimeShort(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function shortHash(hash: string | null | undefined): string {
  if (!hash) return "—";
  return `${hash.slice(0, 10)}…${hash.slice(-8)}`;
}
