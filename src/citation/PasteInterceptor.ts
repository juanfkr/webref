import type { Editor, MarkdownFileInfo, MarkdownView } from "obsidian";
import { asString, isSameText } from "../shared/text";
import type { CitationInserter } from "./CitationInserter";
import type { WebCopyStore } from "./WebCopyStore";

/**
 * Intercepts note pasting and turns it into a citation when the pasted text is
 * the same text that was copied from the native Web viewer.
 *
 * The comparison is deliberately tolerant of whitespace and line-break
 * differences, which are common between the page selection and the clipboard
 * contents.
 */
export class PasteInterceptor {
  /**
   * @param store Storage for the latest Web viewer copy.
   * @param inserter Service that inserts the citation into the note.
   */
  constructor(
    private readonly store: WebCopyStore,
    private readonly inserter: CitationInserter
  ) {}

  /**
   * Handles the Obsidian `editor-paste` event.
   *
   * When the pasted text matches the Web viewer capture, the default behavior
   * is cancelled and the formatted citation is inserted instead.
   *
   * @param event Editor paste event.
   * @param editor Editor that will receive the content.
   * @param info Information about the target note.
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
