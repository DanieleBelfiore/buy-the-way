/** Strip url-like tokens from free-text names (same invariant as notify-list-event). */
export const sanitizeFreeText = (raw: string, maxLen = 120): string =>
  raw
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/\bwww\.\S+/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
