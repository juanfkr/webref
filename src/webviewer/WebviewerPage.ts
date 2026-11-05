import { WebCopy } from "../citation/WebCopy";
import { asString } from "../shared/text";
import type {
  WebviewElementLike,
  WebviewerViewLike,
} from "../shared/types";
import { MAX_TEXT_CHARS } from "./constants";

/**
 * Encapsulates access to the native Web viewer's internal view.
 *
 * Centralizing this access keeps the details of Obsidian's internal API from
 * spreading through the rest of the plugin. If the structure changes in a
 * future version, only this class needs to be adjusted.
 */
export class WebviewerPage {
  /**
   * @param source Internal `webviewer` view object.
   */
  constructor(private readonly source: WebviewerViewLike) {}

  /** Returns the original internal view. */
  get view(): WebviewerViewLike {
    return this.source;
  }

  /** Current `<webview>` element, when present. */
  get webview(): WebviewElementLike | undefined {
    return this.source.webview;
  }

  /** Whether the page is being displayed in reader mode. */
  get isReaderMode(): boolean {
    return this.source.mode === "reader";
  }

  /** Whether the page's current selection can be read. */
  get canReadSelection(): boolean {
    return (
      this.isReaderMode ||
      typeof this.webview?.executeJavaScript === "function"
    );
  }

  /**
   * Creates a capture using the page's current URL and title.
   *
   * @param text Selected text.
   */
  capture(text: string): WebCopy {
    const webview = this.webview;

    let url = "";
    try {
      url = asString(webview?.getURL?.());
    } catch {
      // Webview destroyed during the read.
    }
    if (!url) url = asString(this.source.url);

    let title = "";
    try {
      title = asString(webview?.getTitle?.());
    } catch {
      // Webview destroyed during the read.
    }
    if (!title) title = asString(this.source.title);

    return new WebCopy(
      text.slice(0, MAX_TEXT_CHARS),
      url.trim(),
      title.trim() || url.trim(),
      Date.now()
    );
  }

  /**
   * Reads the current selection.
   *
   * In reader mode the selection belongs to the Obsidian document; in normal
   * mode it is inside the page loaded in the webview.
   */
  async readSelection(): Promise<string> {
    if (this.isReaderMode) {
      return document.getSelection()?.toString() ?? "";
    }

    const webview = this.webview;
    if (!webview?.executeJavaScript) return "";

    try {
      const result = await webview.executeJavaScript(
        "window.getSelection().toString()",
        true
      );
      return asString(result);
    } catch (error) {
      console.error(
        "WebRef: falha ao ler a seleção",
        error
      );
      return "";
    }
  }

  /**
   * Copies the guest's current selection to the clipboard.
   *
   * Used by the native "Copy" item in the context menu.
   */
  copySelectionToClipboard(): void {
    try {
      this.webview?.copy?.();
    } catch (error) {
      console.error(
        "WebRef: falha ao copiar seleção",
        error
      );
    }
  }
}
