import { MarkdownView, Notice } from "obsidian";
import type { App, Editor, WorkspaceLeaf } from "obsidian";
import { CitationFormatter } from "./CitationFormatter";
import type { WebCopy } from "./WebCopy";

/** Função usada para exibir mensagens curtas ao usuário. */
export type NoticeCallback = (message: string) => void;

/**
 * Insere citações na última nota Markdown ativa.
 *
 * A view do Web viewer recebe o foco quando o usuário interage com a página,
 * então a nota de destino é lembrada separadamente. Na colagem, porém, o
 * editor correto é passado diretamente pelo evento do Obsidian.
 */
export class CitationInserter {
  private lastMarkdownView: MarkdownView | null = null;

  /**
   * @param app Aplicativo do Obsidian.
   * @param formatter Responsável por montar o bloco Markdown.
   * @param notify Função de aviso; pode ser substituída em testes.
   */
  constructor(
    private readonly app: App,
    private readonly formatter: CitationFormatter,
    private readonly notify: NoticeCallback = (message) =>
      new Notice(message)
  ) {}

  /**
   * Lembra a nota quando uma leaf Markdown passa a ser a ativa.
   *
   * @param leaf Leaf que recebeu o foco.
   */
  trackLeaf(leaf: WorkspaceLeaf | null): void {
    if (leaf?.view instanceof MarkdownView) {
      this.lastMarkdownView = leaf.view;
    }
  }

  /** Registra a nota Markdown ativa no momento da inicialização. */
  trackActiveView(): void {
    const markdown = this.app.workspace.getActiveViewOfType(
      MarkdownView
    );
    if (markdown) this.lastMarkdownView = markdown;
  }

  /**
   * Insere uma citação na nota de destino.
   *
   * @param copy Captura do Web viewer a citar.
   * @param editor Editor de destino. Quando omitido, usa a última nota ativa.
   * @param noteName Nome da nota para a mensagem de confirmação.
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

      const targetName = noteName ?? this.getTargetNoteName();
      this.notify(
        targetName
          ? `Citação inserida em "${targetName}".`
          : "Citação inserida na nota."
      );
    } catch (error) {
      console.error(
        "Webview Text Selector: falha ao inserir citação",
        error
      );
      this.notify("Não foi possível inserir a citação na nota.");
    }
  }

  /**
   * Encontra o editor da nota ativa ou da última nota Markdown lembrada.
   *
   * A leaf é validada para evitar usar uma view que já foi fechada.
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

  /** Retorna o nome da nota de destino, quando disponível. */
  private getTargetNoteName(): string | undefined {
    const active = this.app.workspace.getActiveViewOfType(
      MarkdownView
    );
    const target = active ?? this.lastMarkdownView;
    return target?.file?.basename;
  }

  /**
   * Garante que o bloco de citação comece e termine em linhas próprias
   * quando o cursor está no meio de um parágrafo.
   *
   * @param editor Editor que receberá a citação.
   * @param citation Bloco já formatado.
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
      // Alguns editores não expõem getCursor/getLine; insere direto.
    }

    return prefix + citation + suffix;
  }
}
