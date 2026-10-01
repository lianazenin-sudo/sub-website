/**
 * Converts HTML email bodies into plain text the classifier can read.
 *
 * Receipts are mostly tables ("Total" in one cell, "$10.79" in the next), so
 * cells are joined with " | " and rows become lines; that keeps each label
 * next to its value ("Amount charged | $15.49"). The output is for analysis
 * only and is never stored.
 */

const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  euro: "€",
  pound: "£",
  yen: "¥",
  cent: "¢",
  copy: "©",
  reg: "®",
  trade: "™",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  middot: "·",
  bull: "•",
  zwnj: "",
  zwj: "",
  shy: "",
};

/**
 * Replaces HTML entities (&amp;, &#36;, &#x20AC;) with the characters they
 * stand for. Unknown named entities are left untouched.
 */
export function decodeEntities(input: string): string {
  return input.replace(
    /&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z]{2,8});/gi,
    (match, code: string) => {
      if (code.startsWith("#")) {
        const isHex = code[1] === "x" || code[1] === "X";
        const codePoint = isHex
          ? parseInt(code.slice(2), 16)
          : parseInt(code.slice(1), 10);
        return Number.isFinite(codePoint) &&
          codePoint > 0 &&
          codePoint <= 0x10ffff
          ? String.fromCodePoint(codePoint)
          : match;
      }
      return NAMED_ENTITIES[code.toLowerCase()] ?? match;
    },
  );
}

/**
 * Collapses runs of spaces/tabs (including non-breaking and zero-width
 * spaces), trims every line and keeps at most one blank line in a row, so
 * the rule patterns see predictable spacing.
 */
export function tidyWhitespace(input: string): string {
  return input
    .replace(/\r\n?/g, "\n")
    .replace(/[\t\f\v \u00a0\u2000-\u200b\u202f\u205f\u3000\ufeff]+/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Converts an HTML body to readable plain text: removes invisible blocks
 * (head, style, script, comments), turns block-level tags into line breaks
 * and table cells into spaced columns, strips the remaining tags, decodes
 * entities, tidies whitespace and drops cell separators left dangling at
 * the start or end of a line.
 */
export function htmlToText(html: string): string {
  const text = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(
      /<(script|style|head|title|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,
      " ",
    )
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(
      /<\/(?:p|div|tr|li|h[1-6]|table|section|article|header|footer|blockquote)\s*>/gi,
      "\n",
    )
    .replace(/<\/(?:td|th)\s*>/gi, " | ")
    .replace(/<[^>]*>/g, " ");
  return tidyWhitespace(decodeEntities(text))
    .split("\n")
    .map((line) => line.replace(/^(?:\|\s*)+|(?:\s*\|)+$/g, "").trim())
    .join("\n");
}
