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
    (value: string, pattern: RegExp = /[^\x20-\x7E\u{1F300}-\u{1FAF8}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu): string => {
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
