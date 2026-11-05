import { MarkdownView, Notice } from "obsidian";
import type { App, Editor, WorkspaceLeaf } from "obsidian";
import { CitationFormatter } from "./CitationFormatter";
import type { WebCopy } from "./WebCopy";

/** Function used to show short messages to the user. */
export type NoticeCallback = (message: string) => void;

/**
 * Inserts citations into the last active Markdown note.
 *
 * The Web viewer view receives focus when the user interacts with the page, so
 * the target note is tracked separately. On paste, however, the correct editor
 * is provided directly by the Obsidian event.
 */
export class CitationInserter {
  private lastMarkdownView: MarkdownView | null = null;

  /**
   * @param app Obsidian application.
   * @param formatter Responsible for building the Markdown block.
   * @param notify Notification function; can be replaced in tests.
   */
  constructor(
    private readonly app: App,
    private readonly formatter: CitationFormatter,
    private readonly notify: NoticeCallback = (message) =>
      new Notice(message)
  ) {}

  /**
   * Remembers the note when a Markdown leaf becomes active.
   *
   * @param leaf Leaf that received focus.
   */
  trackLeaf(leaf: WorkspaceLeaf | null): void {
    if (leaf?.view instanceof MarkdownView) {
      this.lastMarkdownView = leaf.view;
    }
  }

  /** Records the active Markdown note at startup. */
  trackActiveView(): void {
    const markdown = this.app.workspace.getActiveViewOfType(
      MarkdownView
    );
    if (markdown) this.lastMarkdownView = markdown;
  }

  /**
   * Inserts a citation into the target note.
   *
   * @param copy Web viewer capture to cite.
   * @param editor Target editor. When omitted, uses the last active note.
   * @param noteName Note name for the confirmation message.
   */
  insert(copy: WebCopy, editor?: Editor, noteName?: string): void {
    const target = editor ?? this.resolveTargetEditor();

    if (!target) {
      this.notify(
        "Abra uma nota em Markdown para inserir a citação."
      );
      return;
    }

    const citation = this.formatter.format(copy);

    try {
      target.replaceSelection(
        this.withSurroundingBreaks(target, citation)
      );

      this.notify(
        noteName
          ? `Citação inserida em "${noteName}".`
          : "Citação inserida na nota."
      );
    } catch (error) {
      console.error(
        "WebRef: falha ao inserir citação",
        error
      );
      this.notify("Não foi possível inserir a citação na nota.");
    }
  }

  /**
   * Finds the editor of the active note or of the last remembered Markdown
   * note.
   *
   * The leaf is validated to avoid using a view that has already been closed.
   */
  private resolveTargetEditor(): Editor | null {
    const active = this.app.workspace.getActiveViewOfType(
      MarkdownView
    );
    if (active) return active.editor;

    const last = this.lastMarkdownView;
    if (!last) return null;

    const leaves = this.app.workspace.getLeavesOfType("markdown");
    if (!leaves.some((leaf) => leaf.view === last)) return null;

    try {
      return last.editor;
    } catch {
      return null;
    }
  }

  /**
   * Ensures the citation block starts and ends on its own lines when the
   * cursor is in the middle of a paragraph.
   *
   * @param editor Editor that will receive the citation.
   * @param citation Already formatted block.
   */
  private withSurroundingBreaks(
    editor: Editor,
    citation: string
  ): string {
    let prefix = "";
    let suffix = "";

    try {
      const cursor = editor.getCursor();
      const line = editor.getLine(cursor.line) ?? "";

      if (line.slice(0, cursor.ch).trim().length > 0) prefix = "\n\n";
      if (line.slice(cursor.ch).trim().length > 0) suffix = "\n\n";
    } catch {
      // Some editors do not expose getCursor/getLine; insert directly.
    }

    return prefix + citation + suffix;
  }
}
