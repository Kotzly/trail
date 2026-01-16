import type { components } from "./types";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080/v1";

type ErrorResponse = components["schemas"]["ErrorResponse"];
export type AuthResponse = components["schemas"]["AuthResponse"];
export type RefreshResponse = components["schemas"]["RefreshResponse"];
export type RegisterInput = components["schemas"]["RegisterInput"];
export type LoginInput = components["schemas"]["LoginInput"];
export type Plan = components["schemas"]["Plan"];
export type Subscription = components["schemas"]["Subscription"];
export type BillingStatus = components["schemas"]["BillingStatus"];
export type AccountSnapshot = components["schemas"]["AccountSnapshot"];
export type PortalLink = components["schemas"]["PortalLink"];
export type CheckoutInput = components["schemas"]["CheckoutInput"];

export class ApiError extends Error {
  status: number;
  payload?: ErrorResponse;

  constructor(message: string, status: number, payload?: ErrorResponse) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });

  if (res.status === 204) {
    return undefined as T;
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new ApiError(data?.message ?? "Request failed", res.status, data ?? undefined);
  }
  return data as T;
}

export const api = {
  register: (input: RegisterInput) => request<AuthResponse>("/auth/register", { method: "POST", body: JSON.stringify(input) }),
  login: (input: LoginInput) => request<AuthResponse>("/auth/login", { method: "POST", body: JSON.stringify(input) }),
  refresh: () => request<RefreshResponse>("/auth/refresh", { method: "POST" }),
  logout: () => request<void>("/auth/logout", { method: "POST" }),
  getAccount: (token?: string) => request<AccountSnapshot>("/account", { method: "GET" }, token),
  getMe: (token: string) => request<components["schemas"]["User"]>("/me", { method: "GET" }, token),
  getPlans: () => request<Plan[]>("/plans", { method: "GET" }),
  getSubscription: (token: string) => request<Subscription | null>("/subscriptions/me", { method: "GET" }, token),
  cancelSubscription: (token: string) => request<Subscription>("/subscriptions/cancel", { method: "POST" }, token),
  getBilling: (token: string) => request<BillingStatus | null>("/billing", { method: "GET" }, token),
  billingPortal: (token: string) => request<PortalLink>("/billing/portal", { method: "POST" }, token),
  checkout: (token: string, input: CheckoutInput) => request<PortalLink>("/billing/checkout", { method: "POST", body: JSON.stringify(input) }, token),
};
