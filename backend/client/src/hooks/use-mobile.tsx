import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(false)

  React.useEffect(() => {
    if (typeof window === "undefined" || !("matchMedia" in window)) {
      setIsMobile(false);
      return;
    }

    const query = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;
    const mql = window.matchMedia(query);

    const onChange = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsMobile("matches" in e ? e.matches : mql.matches);
    };

    setIsMobile(mql.matches);

    if ("addEventListener" in mql) {
      mql.addEventListener("change", onChange as EventListener);
      return () => mql.removeEventListener("change", onChange as EventListener);
    } else {
      (mql as MediaQueryList & { addListener: (cb: (e: MediaQueryListEvent) => void) => void }).addListener(onChange as (e: MediaQueryListEvent) => void);
      return () => (mql as MediaQueryList & { removeListener: (cb: (e: MediaQueryListEvent) => void) => void }).removeListener(onChange as (e: MediaQueryListEvent) => void);
    }
  }, [])

  return isMobile
}
