import { asString } from "../shared/text";
import type { WebviewElementLike } from "../shared/types";
import { COPY_MARKER, MAX_TEXT_CHARS } from "./constants";

/** Data sent by the script injected into the page. */
export interface PageBridgePayload {
  text: string;
  url: string;
  title: string;
}

/**
 * Installs and interprets the communication bridge with the Web viewer page.
 *
 * Obsidian runs the webview in sandbox mode and without a preload, so there is
 * no `ipcRenderer` available. The bridge uses `executeJavaScript()` to inject a
 * script and `console.log` + the `console-message` event to bring the text back
 * to the main process.
 */
export class PageBridge {
  /**
   * Installs the capture script into the webview's current page.
   *
   * Installation is idempotent: the script itself ignores repeated calls.
   *
   * @param webview Native Web viewer element.
   */
  static install(webview: WebviewElementLike): void {
    if (typeof webview.executeJavaScript !== "function") return;

    const script = `(${String(installPageBridge)})(${JSON.stringify(
      COPY_MARKER
    )}, ${MAX_TEXT_CHARS});`;

    try {
      const result = webview.executeJavaScript(script, true);
      if (result && typeof result.catch === "function") {
        result.catch(() => undefined);
      }
    } catch {
      // The page may have been destroyed or navigated during injection.
    }
  }

  /**
   * Reads and validates a message received through the `console-message` event.
   *
   * @param event Event emitted by the `<webview>`.
   * @returns The copy data, or `null` when the message is not from the bridge.
   */
  static parseConsoleMessage(event: Event): PageBridgePayload | null {
    const payload = event as Event & {
      message?: unknown;
      details?: { message?: unknown };
    };

    const message =
      typeof payload.message === "string"
        ? payload.message
        : typeof payload.details?.message === "string"
        ? payload.details.message
        : "";

    const markerIndex = message.indexOf(COPY_MARKER);
    if (markerIndex === -1) return null;

    try {
      const data = JSON.parse(
        message.slice(markerIndex + COPY_MARKER.length)
      ) as {
        text?: unknown;
        url?: unknown;
        title?: unknown;
      };

      const text = asString(data.text);
      if (!text.trim()) return null;

      return {
        text: text.slice(0, MAX_TEXT_CHARS),
        url: asString(data.url),
        title: asString(data.title),
      };
    } catch {
      // Unrelated console message or invalid payload.
      return null;
    }
  }
}

/**
 * Script executed inside the page.
 *
 * It must be self-contained: it is serialized with `Function#toString()` and
 * runs in the guest, without access to the plugin scope. Do not move external
 * logic into this function or reference variables from outside it.
 *
 * @param marker Marker used to identify messages in the console.
 * @param maxChars Character limit sent to the host.
 */
function installPageBridge(marker: string, maxChars: number): void {
  const win = window as unknown as {
    __webrefCiteBridgeInstalled?: boolean;
  };
  if (win.__webrefCiteBridgeInstalled) return;
  win.__webrefCiteBridgeInstalled = true;

  const readSelection = (): string => {
    const active = document.activeElement as
      | HTMLInputElement
      | HTMLTextAreaElement
      | null;

    if (
      active &&
      (active.tagName === "INPUT" || active.tagName === "TEXTAREA")
    ) {
      try {
        const start = active.selectionStart;
        const end = active.selectionEnd;
        if (start !== null && end !== null && end > start) {
          return active.value.slice(start, end);
        }
      } catch {
        // Some input types do not expose selectionStart/selectionEnd.
      }
    }

    const selection = window.getSelection();
    return selection ? selection.toString() : "";
  };

  const send = (): void => {
    const text = readSelection()
      .replace(/\u00a0/g, " ")
      .trim();

    if (!text) return;

    try {
      console.log(
        marker +
          JSON.stringify({
            text: text.slice(0, maxChars),
            url: location.href,
            title: document.title,
          })
      );
    } catch {
      // The page may have replaced the console; there is no other channel.
    }
  };

  let timer: number | null = null;
  const schedule = (): void => {
    if (timer !== null) window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      timer = null;
      send();
    }, 0);
  };

  // The "copy" event covers Ctrl+C, the native menu and programmatic copies.
  document.addEventListener("copy", schedule, true);

  // Fallback for browsers/pages that do not fire "copy".
  document.addEventListener(
    "keydown",
    (event) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        !event.shiftKey &&
        event.key.toLowerCase() === "c"
      ) {
        schedule();
      }
    },
    true
  );
}
