// JSON.stringify does not escape `<`, `>`, or `&`. When the resulting string
// is embedded inside a <script type="application/ld+json"> tag, a value
// containing `</script>` would prematurely terminate the embedding context.
// Escape these characters as Unicode escapes so the output stays valid JSON
// and safe to inline inside HTML.
export const safeJsonLd = (obj: unknown): string =>
  JSON.stringify(obj)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
