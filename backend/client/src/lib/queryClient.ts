import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    const error = new Error(`${res.status}: ${text}`);
    (error as any).status = res.status;
    throw error;
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
  signal?: AbortSignal,
): Promise<Response> {
  const headers: Record<string, string> = data ? { "Content-Type": "application/json" } : {};
  
  // Add admin JWT token if available (for admin routes)
  const adminToken = localStorage.getItem("adminToken");
  if (adminToken && url.includes("/api/admin")) {
    headers["Authorization"] = `Bearer ${adminToken}`;
  }
  
  // Legacy admin password header (for old system)
  const adminPassword = localStorage.getItem("adminPassword");
  if (adminPassword && url.includes("/api/admin")) {
    headers["x-admin-password"] = adminPassword;
  }
  
  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
    signal,
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const url = queryKey.join("/") as string;
    
    // Build headers
    const headers: Record<string, string> = {};
    
    // Add admin JWT token if this is an admin route
    const adminToken = localStorage.getItem("adminToken");
    if (adminToken && url.includes("/api/admin")) {
      headers["Authorization"] = `Bearer ${adminToken}`;
    }
    
    const res = await fetch(url, {
      credentials: "include",
      headers,
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
