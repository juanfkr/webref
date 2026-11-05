import { asString } from "../shared/text";
import type { WebCopy } from "./WebCopy";

/**
 * Builds the Markdown block for a citation.
 *
 * The produced format is:
 *
 * ```markdown
 * > selected text
 * >
 * > [Page title](<https://example.com>)
 * ```
 *
 * The footer contains only the formatted hyperlink, with no date or time.
 */
export class CitationFormatter {
  /**
   * Converts a Web viewer capture into a citation block.
   *
   * @param copy Capture to format.
   * @returns Markdown block ready to be inserted into the note.
   */
  format(copy: WebCopy): string {
    const text = this.normalizeText(copy.text);
    const quoted = text
      .split("\n")
      .map((line) => this.quoteLine(line))
      .join("\n");

    return `${quoted}\n>\n> ${this.formatSource(copy)}`;
  }

  /**
   * Standardizes line breaks and removes leading/trailing whitespace.
   *
   * @param text Original selection text.
   */
  private normalizeText(text: string): string {
    return asString(text)
      .replace(/\u00a0/g, " ")
      .replace(/\r\n?/g, "\n")
      .trim();
  }

  /**
   * Applies the quote marker to a single line.
   *
   * Empty lines become `>` so the original text's paragraphs are preserved.
   *
   * @param line Original line.
   */
  private quoteLine(line: string): string {
    const withoutTrailingSpaces = line.replace(/[ \t]+$/g, "");
    return withoutTrailingSpaces.trim().length > 0
      ? `> ${withoutTrailingSpaces}`
      : ">";
  }

  /**
   * Builds the footer with the page title and link.
   *
   * @param copy Source capture.
   */
  private formatSource(copy: WebCopy): string {
    const url = asString(copy.url).trim().replace(/[\r\n]+/g, "");
    const rawTitle = (asString(copy.title).trim() || url || "Fonte")
      .replace(/\s+/g, " ")
      .trim();
    const safeTitle = rawTitle.replace(/([\\[\]])/g, "\\$1");

    return url ? `[${safeTitle}](<${url}>)` : safeTitle;
  }
}
