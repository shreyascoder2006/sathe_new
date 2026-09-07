"use client";

import useSWR, { mutate as globalMutate, type SWRConfiguration } from "swr";

export const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json();
};

export function useApi<T>(key: string | null, config?: SWRConfiguration) {
  return useSWR<T>(key, fetcher, {
    revalidateOnFocus: false,
    keepPreviousData: true,
    ...config,
  });
}

export async function apiSend<T = unknown>(
  url: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data as T;
}

/** Revalidate the shared live surfaces after a mutation. */
export function refreshCampus() {
  return Promise.all([
    globalMutate("/api/metrics"),
    globalMutate("/api/buildings"),
    globalMutate("/api/activity?limit=25"),
    globalMutate("/api/notifications"),
    globalMutate("/api/incidents"),
    globalMutate("/api/automation/executions?limit=20"),
    globalMutate((k) => typeof k === "string" && k.startsWith("/api/"), undefined, {
      revalidate: true,
    }),
  ]);
}
