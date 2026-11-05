import { WebCopy } from "../citation/WebCopy";
import { asString } from "../shared/text";
import type {
  WebviewElementLike,
  WebviewerViewLike,
} from "../shared/types";
import { MAX_TEXT_CHARS } from "./constants";

/**
 * Encapsula o acesso à view interna do Web viewer nativo.
 *
 * Centralizar esse acesso evita que detalhes da API interna do Obsidian se
 * espalhem pelo restante do plugin. Se a estrutura mudar em uma versão futura,
 * basta ajustar esta classe.
 */
export class WebviewerPage {
  /**
   * @param source Objeto interno da view `webviewer`.
   */
  constructor(private readonly source: WebviewerViewLike) {}

  /** Retorna a view interna original. */
  get view(): WebviewerViewLike {
    return this.source;
  }

  /** Elemento `<webview>` atual, quando existir. */
  get webview(): WebviewElementLike | undefined {
    return this.source.webview;
  }

  /** Indica se a página está sendo exibida no modo leitor. */
  get isReaderMode(): boolean {
    return this.source.mode === "reader";
  }

  /** Indica se é possível ler a seleção atual da página. */
  get canReadSelection(): boolean {
    return (
      this.isReaderMode ||
      typeof this.webview?.executeJavaScript === "function"
    );
  }

  /**
   * Cria uma captura usando a URL e o título atuais da página.
   *
   * @param text Texto selecionado.
   */
  capture(text: string): WebCopy {
    const webview = this.webview;

    let url = "";
    try {
      url = asString(webview?.getURL?.());
    } catch {
      // Webview destruída durante a leitura.
    }
    if (!url) url = asString(this.source.url);

    let title = "";
    try {
      title = asString(webview?.getTitle?.());
    } catch {
      // Webview destruída durante a leitura.
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
   * Lê a seleção atual.
   *
   * No modo leitor a seleção pertence ao documento do Obsidian; no modo
   * normal ela está dentro da página carregada no webview.
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
        "Webview Text Selector: falha ao ler a seleção",
        error
      );
      return "";
    }
  }

  /**
   * Copia a seleção atual do convidado para a área de transferência.
   *
   * Usado pelo item nativo "Copiar" do menu de contexto.
   */
  copySelectionToClipboard(): void {
    try {
      this.webview?.copy?.();
    } catch (error) {
      console.error(
        "Webview Text Selector: falha ao copiar seleção",
        error
      );
    }
  }
}
