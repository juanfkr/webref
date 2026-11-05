import { WebCopy } from "../citation/WebCopy";
import type { WebCopyStore } from "../citation/WebCopyStore";
import type { WebviewElementLike } from "../shared/types";
import { PageBridge } from "./PageBridge";

/**
 * Conecta um `<webview>` ao armazenamento de cópias.
 *
 * A classe cuida apenas do ciclo de vida dos listeners e da tradução das
 * mensagens da página para objetos `WebCopy`.
 */
export class WebviewCopyChannel {
  /**
   * @param store Armazenamento que receberá as cópias.
   */
  constructor(private readonly store: WebCopyStore) {}

  /**
   * Conecta o canal a um webview.
   *
   * O script é instalado imediatamente, caso a página já esteja pronta, e
   * novamente a cada `dom-ready` para sobreviver a navegações.
   *
   * @param webview Elemento do Web viewer nativo.
   * @returns Função que remove os listeners adicionados.
   */
  connect(webview: WebviewElementLike): () => void {
    const onDomReady = (): void => {
      PageBridge.install(webview);
    };

    const onConsoleMessage = (event: Event): void => {
      this.handleConsoleMessage(event);
    };

    webview.addEventListener("dom-ready", onDomReady);
    webview.addEventListener("console-message", onConsoleMessage);

    PageBridge.install(webview);

    return () => {
      webview.removeEventListener("dom-ready", onDomReady);
      webview.removeEventListener(
        "console-message",
        onConsoleMessage
      );
    };
  }

  /**
   * Converte uma mensagem válida da ponte em uma captura armazenada.
   *
   * @param event Evento `console-message` do webview.
   */
  private handleConsoleMessage(event: Event): void {
    const payload = PageBridge.parseConsoleMessage(event);
    if (!payload) return;

    this.store.remember(
      new WebCopy(
        payload.text,
        payload.url,
        payload.title,
        Date.now()
      )
    );
  }
}
