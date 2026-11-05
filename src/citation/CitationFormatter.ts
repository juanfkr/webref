import { asString } from "../shared/text";
import type { WebCopy } from "./WebCopy";

/**
 * Monta o bloco Markdown de uma citação.
 *
 * O formato produzido é:
 *
 * ```markdown
 * > texto selecionado
 * >
 * > [Título da página](<https://exemplo.com>)
 * ```
 *
 * O rodapé contém apenas o hyperlink formatado, sem data ou hora.
 */
export class CitationFormatter {
  /**
   * Converte uma captura do Web viewer em um bloco de citação.
   *
   * @param copy Captura a formatar.
   * @returns Bloco Markdown pronto para ser inserido na nota.
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
   * Padroniza quebras de linha e remove espaços nas extremidades.
   *
   * @param text Texto original da seleção.
   */
  private normalizeText(text: string): string {
    return asString(text)
      .replace(/\u00a0/g, " ")
      .replace(/\r\n?/g, "\n")
      .trim();
  }

  /**
   * Aplica o marcador de citação em uma linha.
   *
   * Linhas vazias viram `>` para preservar os parágrafos do texto original.
   *
   * @param line Linha original.
   */
  private quoteLine(line: string): string {
    const withoutTrailingSpaces = line.replace(/[ \t]+$/g, "");
    return withoutTrailingSpaces.trim().length > 0
      ? `> ${withoutTrailingSpaces}`
      : ">";
  }

  /**
   * Monta o rodapé com o título e o link da página.
   *
   * @param copy Captura de origem.
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
