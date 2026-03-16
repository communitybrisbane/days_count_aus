import { useState, useCallback, useRef } from "react";

/**
 * Hook that filters non-ASCII input and shows a temporary warning.
 * Returns { warn, showWarn, sanitize }
 * - sanitize(value, pattern?): returns cleaned string, triggers warning if chars were removed
 * - showWarn: boolean to display warning
 * - warn: warning message string
 */
export function useAsciiInput() {
  const [showWarn, setShowWarn] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sanitize = useCallback(
    (value: string, pattern: RegExp = /[^\x20-\x7E]/g): string => {
      const cleaned = value.replace(pattern, "");
      if (cleaned !== value) {
        setShowWarn(true);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setShowWarn(false), 2000);
      }
      return cleaned;
    },
    []
  );

  return { showWarn, warn: "English characters only", sanitize };
}
