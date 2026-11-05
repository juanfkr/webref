import type { Editor, MarkdownFileInfo, MarkdownView } from "obsidian";
import { asString, isSameText } from "../shared/text";
import type { CitationInserter } from "./CitationInserter";
import type { WebCopyStore } from "./WebCopyStore";

/**
 * Intercepta a colagem de uma nota e a transforma em citação quando o texto
 * colado é o mesmo que foi copiado do Web viewer nativo.
 *
 * A comparação é deliberadamente tolerante a diferenças de espaços e quebras
 * de linha, comuns entre a seleção da página e o conteúdo da área de
 * transferência.
 */
export class PasteInterceptor {
  /**
   * @param store Armazenamento da última cópia do Web viewer.
   * @param inserter Serviço que insere a citação na nota.
   */
  constructor(
    private readonly store: WebCopyStore,
    private readonly inserter: CitationInserter
  ) {}

  /**
   * Trata o evento `editor-paste` do Obsidian.
   *
   * Quando o texto colado corresponde à captura do Web viewer, o
   * comportamento padrão é cancelado e a citação formatada é inserida.
   *
   * @param event Evento de colagem do editor.
   * @param editor Editor que receberá o conteúdo.
   * @param info Informações da nota de destino.
   */
  handle(
    event: ClipboardEvent,
    editor: Editor,
    info: MarkdownView | MarkdownFileInfo
  ): void {
    if (event.defaultPrevented) return;

    const copy = this.store.getCurrent();
    if (!copy) return;

    const clipboardText = asString(
      event.clipboardData?.getData("text/plain")
    );

    if (!clipboardText.trim()) return;
    if (!isSameText(clipboardText, copy.text)) return;

    event.preventDefault();

    const noteName = (
      info as { file?: { basename?: string } | null } | null
    )?.file?.basename;

    this.inserter.insert(copy, editor, noteName);
  }
}
