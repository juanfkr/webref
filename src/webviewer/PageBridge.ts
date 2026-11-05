import { asString } from "../shared/text";
import type { WebviewElementLike } from "../shared/types";
import { COPY_MARKER, MAX_TEXT_CHARS } from "./constants";

/** Dados enviados pelo script injetado na página. */
export interface PageBridgePayload {
  text: string;
  url: string;
  title: string;
}

/**
 * Instala e interpreta a ponte de comunicação com a página do Web viewer.
 *
 * O Obsidian executa o webview em modo sandbox e sem preload, então não há
 * `ipcRenderer` disponível. A ponte usa `executeJavaScript()` para injetar um
 * script e `console.log` + evento `console-message` para trazer o texto de
 * volta ao processo principal.
 */
export class PageBridge {
  /**
   * Instala o script de captura na página atual do webview.
   *
   * A instalação é idempotente: o próprio script ignora chamadas repetidas.
   *
   * @param webview Elemento do Web viewer nativo.
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
      // A página pode ter sido destruída/navegada durante a injeção.
    }
  }

  /**
   * Lê e valida uma mensagem recebida pelo evento `console-message`.
   *
   * @param event Evento emitido pelo `<webview>`.
   * @returns Os dados da cópia ou `null` quando a mensagem não é da ponte.
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
      // Mensagem de console não relacionada ou payload inválido.
      return null;
    }
  }
}

/**
 * Script executado dentro da página.
 *
 * Precisa ser autossuficiente: é serializado com `Function#toString()` e
 * executado no convidado, sem acesso ao escopo do plugin. Não mova lógica
 * externa para dentro desta função nem referencie variáveis de fora.
 *
 * @param marker Marcador usado para identificar as mensagens no console.
 * @param maxChars Limite de caracteres enviados ao host.
 */
function installPageBridge(marker: string, maxChars: number): void {
  const win = window as unknown as {
    __wvsCiteBridgeInstalled?: boolean;
  };
  if (win.__wvsCiteBridgeInstalled) return;
  win.__wvsCiteBridgeInstalled = true;

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
        // Alguns tipos de input não expõem selectionStart/selectionEnd.
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
      // A página pode ter substituído o console; não há outro canal.
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

  // O evento "copy" cobre Ctrl+C, menu nativo e cópia programática.
  document.addEventListener("copy", schedule, true);

  // Reforço para navegadores/páginas que não disparem "copy".
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
