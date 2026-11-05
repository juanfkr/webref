/**
 * Converts an unknown value into a safe string.
 *
 * Useful when reading data coming from the page, where any value may arrive
 * through `console-message` or Obsidian's internal APIs.
 *
 * @param value Value to convert.
 * @returns The value itself when it is already a string; otherwise, an empty
 * string.
 */
export function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * Checks whether a string has visible content.
 *
 * @param value Text to check.
 */
export function hasVisibleText(value: string): boolean {
  return value.trim().length > 0;
}

/**
 * Normalizes whitespace differences between `window.getSelection()` and the
 * `text/plain` placed on the clipboard by Chromium.
 *
 * @param value Original text.
 * @returns Text without repeated spaces, without common invisible characters,
 * and without leading or trailing whitespace.
 */
export function normalizeForComparison(value: string): string {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/[\u200b-\u200d\ufeff]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Compares the text captured in the Web viewer with the text the user pasted.
 *
 * The first comparison ignores only whitespace differences. If it fails, a
 * second comparison also ignores the line breaks inserted by Chromium when
 * building `text/plain` between HTML blocks.
 *
 * @param left First text.
 * @param right Second text.
 */
export function isSameText(left: string, right: string): boolean {
  const normalizedLeft = normalizeForComparison(left);
  const normalizedRight = normalizeForComparison(right);

  if (!normalizedLeft || !normalizedRight) return false;
  if (normalizedLeft === normalizedRight) return true;

  return (
    normalizedLeft.replace(/\s/g, "") ===
    normalizedRight.replace(/\s/g, "")
  );
}
