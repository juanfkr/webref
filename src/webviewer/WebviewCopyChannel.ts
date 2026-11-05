import { WebCopy } from "../citation/WebCopy";
import type { WebCopyStore } from "../citation/WebCopyStore";
import type { WebviewElementLike } from "../shared/types";
import { PageBridge } from "./PageBridge";

/**
 * Connects a `<webview>` to the copy store.
 *
 * This class only handles the listener lifecycle and the translation of page
 * messages into `WebCopy` objects.
 */
export class WebviewCopyChannel {
  /**
   * @param store Store that will receive the copies.
   */
  constructor(private readonly store: WebCopyStore) {}

  /**
   * Connects the channel to a webview.
   *
   * The script is installed immediately in case the page is already ready, and
   * again on every `dom-ready` to survive navigations.
   *
   * @param webview Native Web viewer element.
   * @returns Function that removes the added listeners.
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
   * Converts a valid bridge message into a stored capture.
   *
   * @param event The webview's `console-message` event.
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
