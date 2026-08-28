import * as React from "react"

/*
 * The app's single breakpoint, defined once as `--breakpoint-desktop` in
 * src/index.css (@theme). Tailwind emits theme variables as CSS custom
 * properties on :root, so this hook reads the exact value the `desktop:`
 * variant compiles to — one source of truth, two strategies:
 *   - CSS:  base styles = compact, `desktop:` = at/above the breakpoint
 *   - TS:   useIsMobile() === true below the breakpoint
 */
const FALLBACK_BREAKPOINT = "80rem"

function desktopBreakpoint(): string {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue("--breakpoint-desktop")
    .trim()
  return value || FALLBACK_BREAKPOINT
}

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    // Exact complement of Tailwind's `desktop:` media query (width >= bp).
    const mql = window.matchMedia(`(width < ${desktopBreakpoint()})`)
    const onChange = () => setIsMobile(mql.matches)
    mql.addEventListener("change", onChange)
    setIsMobile(mql.matches)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}
