export function openExternal(url: string, features?: string) {
  if (typeof window !== "undefined") {
    window.open(url, "_blank", features || "noopener,noreferrer");
  }
}

export function getSearchParams(): URLSearchParams {
  if (typeof window === "undefined") {
    return new URLSearchParams();
  }
  return new URLSearchParams(window.location.search);
}

export function downloadBlob(blob: Blob, filename: string) {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export function safeLocalStorageGet(key: string): string | null {
  try {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeLocalStorageSet(key: string, value: string): boolean {
  try {
    if (typeof window === "undefined") return false;
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function safeLocalStorageRemove(key: string): boolean {
  try {
    if (typeof window === "undefined") return false;
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function parseJsonSafe<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}
