import {
  Editor,
  MarkdownView,
  Notice,
  Plugin,
  WorkspaceLeaf,
} from "obsidian";
import type {
  MenuItemLike,
  WebCopy,
  WebviewElementLike,
  WebviewerViewLike,
} from "./types";

/** Tipo interno da view do Web viewer nativo do Obsidian. */
const WEBVIEWER_VIEW_TYPE = "webviewer";

/**
 * Marcador fixo do canal console-message.
 *
 * É intencionalmente fixo (e não um nonce por sessão): se o plugin for
 * recarregado, o script já injetado na página continua enviando cópias e a
 * nova instância do plugin consegue recebê-las.
 */
const COPY_MARKER = "[[WEBVIEW_TEXT_SELECTOR_COPY]]";

/** Teto de segurança para o texto vindo da página. */
const MAX_TEXT_CHARS = 200_000;

const MENU_ITEM_LABEL = "Inserir citação na nota";

/** Evento opcional para integrações com outros plugins. */
const WEB_COPY_EVENT = "webview-text-selector:web-copy";

function safeString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * Normaliza diferenças de espaço em branco entre `window.getSelection()`
 * e o `text/plain` colocado na área de transferência pelo Chromium.
 */
function normalizeForCompare(value: string): string {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/[\u200b-\u200d\ufeff]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function sameText(left: string, right: string): boolean {
  const normalizedLeft = normalizeForCompare(left);
  const normalizedRight = normalizeForCompare(right);
  if (!normalizedLeft || !normalizedRight) return false;
  if (normalizedLeft === normalizedRight) return true;

  // Segunda tentativa: ignora também as quebras de linha/espaços que o
  // Chromium pode inserir entre blocos ao montar o text/plain.
  return (
    normalizedLeft.replace(/\s/g, "") ===
    normalizedRight.replace(/\s/g, "")
  );
}

/** Monta o bloco de citação. O rodapé contém apenas o link formatado. */
function formatCitation(copy: WebCopy): string {
  const text = safeString(copy.text)
    .replace(/\u00a0/g, " ")
    .replace(/\r\n?/g, "\n")
    .trim();

  const lines = text.length > 0 ? text.split("\n") : [""];
  const quoted = lines
    .map((line) => {
      const trimmed = line.replace(/[ \t]+$/g, "");
      return trimmed.trim().length > 0 ? `> ${trimmed}` : ">";
    })
    .join("\n");

  const url = safeString(copy.url).trim().replace(/[\r\n]+/g, "");
  const rawTitle = (safeString(copy.title).trim() || url || "Fonte")
    .replace(/\s+/g, " ")
    .trim();
  const safeTitle = rawTitle.replace(/([\\[\]])/g, "\\$1");
  const source = url ? `[${safeTitle}](<${url}>)` : safeTitle;

  return `${quoted}\n>\n> ${source}`;
}

/**
 * Script injetado dentro da página carregada no Web viewer nativo.
 *
 * Precisa ser autossuficiente: é serializado com Function#toString() e
 * executado no convidado, sem acesso ao escopo do plugin.
 *
 * O Obsidian força `sandbox` e remove preloads dos webviews, então não há
 * ipcRenderer disponível. O único canal de volta é console.log, capturado
 * pelo evento `console-message` do <webview> no host.
 */
function pageBridge(marker: string, maxChars: number): void {
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

export default class WebviewTextSelectorPlugin extends Plugin {
  private lastWebCopy: WebCopy | null = null;
  private lastMarkdownView: MarkdownView | null = null;
  private lastWebviewerView: WebviewerViewLike | null = null;

  private active = true;
  private observer: MutationObserver | null = null;

  private readonly patchedViews = new WeakSet<object>();
  private patches: Array<{ restore: () => void }> = [];

  private readonly hookedWebviews = new WeakSet<WebviewElementLike>();
  private readonly webviewCleanups = new Set<() => void>();

  async onload(): Promise<void> {
    this.registerEvent(
      this.app.workspace.on("editor-paste", (evt, editor, info) => {
        this.handleEditorPaste(evt, editor, info);
      })
    );

    this.registerEvent(
      this.app.workspace.on("active-leaf-change", (leaf) => {
        this.trackLeaf(leaf);
        this.scanWebviewers();
      })
    );

    this.registerEvent(
      this.app.workspace.on("layout-change", () => {
        this.scanWebviewers();
      })
    );

    // Uma cópia feita fora do Web viewer invalida a captura anterior.
    // No modo leitor a seleção está no documento do Obsidian, então ela é
    // capturada aqui (o <webview> fica oculto nesse modo).
    this.registerDomEvent(
      document,
      "copy",
      () => {
        this.handleHostCopy();
      },
      true
    );

    this.registerDomEvent(
      document,
      "cut",
      () => {
        this.lastWebCopy = null;
      },
      true
    );

    this.addCommand({
      id: "cite-web-viewer-selection",
      name: "Inserir citação da seleção atual do Web viewer",
      checkCallback: (checking) => {
        const available = this.getWebviewerView() !== null;
        if (!available) return false;
        if (!checking) void this.citeCurrentSelection();
        return true;
      },
    });

    this.app.workspace.onLayoutReady(() => {
      this.trackActiveView();
      this.scanWebviewers();
      this.observeWebviews();
    });
  }

  onunload(): void {
    this.active = false;

    this.observer?.disconnect();
    this.observer = null;

    for (const cleanup of this.webviewCleanups) {
      try {
        cleanup();
      } catch {
        // Ignora falhas ao remover listeners de webviews já destruídos.
      }
    }
    this.webviewCleanups.clear();

    for (const patch of this.patches) {
      try {
        patch.restore();
      } catch {
        // Ignora falhas ao restaurar métodos de views já descartadas.
      }
    }
    this.patches = [];
  }

  // ---------------------------------------------------------------------
  // Captura no Web viewer nativo
  // ---------------------------------------------------------------------

  private trackLeaf(leaf: WorkspaceLeaf | null): void {
    if (!leaf) return;
    const view = leaf.view;

    if (view instanceof MarkdownView) {
      this.lastMarkdownView = view;
      return;
    }

    if (view && view.getViewType() === WEBVIEWER_VIEW_TYPE) {
      this.lastWebviewerView = view as unknown as WebviewerViewLike;
    }
  }

  private trackActiveView(): void {
    const markdown = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (markdown) this.lastMarkdownView = markdown;
    this.trackLeaf(this.app.workspace.activeLeaf);
  }

  private observeWebviews(): void {
    if (this.observer || !document.body) return;

    this.observer = new MutationObserver((mutations) => {
      if (!this.active) return;

      for (const mutation of mutations) {
        for (const node of Array.from(mutation.addedNodes)) {
          if (!(node instanceof HTMLElement)) continue;
          if (
            node.tagName === "WEBVIEW" ||
            node.querySelector?.("webview")
          ) {
            this.scanWebviewers();
            return;
          }
        }
      }
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  private scanWebviewers(): void {
    if (!this.active) return;

    for (const leaf of this.app.workspace.getLeavesOfType(
      WEBVIEWER_VIEW_TYPE
    )) {
      const view = leaf.view as unknown as WebviewerViewLike;
      if (!view) continue;
      this.patchWebviewerView(view);
    }
  }

  private patchWebviewerView(view: WebviewerViewLike): void {
    if (!this.patchedViews.has(view)) {
      this.patchedViews.add(view);

      const restoreCallbacks: Array<() => void> = [];

      if (typeof view.instantiateWebView === "function") {
        const original = view.instantiateWebView;

        const wrapper = (...args: unknown[]): unknown => {
          const result = original.apply(view, args);
          this.hookWebview(view);
          return result;
        };

        view.instantiateWebView = wrapper;
        restoreCallbacks.push(() => {
          if (view.instantiateWebView === wrapper) {
            view.instantiateWebView = original;
          }
        });
      }

      if (typeof view.contextMenuItemsForSelection === "function") {
        const original = view.contextMenuItemsForSelection;

        const wrapper = (
          selectionText: string,
          isEditable?: boolean
        ): MenuItemLike[] => {
          const items = original.call(view, selectionText, isEditable);
          return this.decorateContextMenu(
            view,
            Array.isArray(items) ? items : [],
            selectionText
          );
        };

        view.contextMenuItemsForSelection = wrapper;
        restoreCallbacks.push(() => {
          if (view.contextMenuItemsForSelection === wrapper) {
            view.contextMenuItemsForSelection = original;
          }
        });
      }

      this.patches.push({
        restore: () => {
          for (const restore of restoreCallbacks) restore();
        },
      });
    }

    this.hookWebview(view);
  }

  private hookWebview(view: WebviewerViewLike): void {
    if (!this.active) return;

    const webview = view.webview;
    if (!webview) return;

    if (!this.hookedWebviews.has(webview)) {
      this.hookedWebviews.add(webview);

      const onDomReady = (): void => {
        this.injectBridge(webview);
      };

      const onConsoleMessage = (event: Event): void => {
        this.handleConsoleMessage(event);
      };

      webview.addEventListener("dom-ready", onDomReady);
      webview.addEventListener("console-message", onConsoleMessage);

      const cleanup = (): void => {
        webview.removeEventListener("dom-ready", onDomReady);
        webview.removeEventListener("console-message", onConsoleMessage);
      };

      this.webviewCleanups.add(cleanup);
    }

    // A view pode ter sido descoberta depois do dom-ready (por exemplo, ao
    // habilitar o plugin com uma página já carregada), então tentamos já.
    this.injectBridge(webview);
  }

  private injectBridge(webview: WebviewElementLike): void {
    if (!this.active || typeof webview.executeJavaScript !== "function") {
      return;
    }

    const script = `(${String(pageBridge)})(${JSON.stringify(
      COPY_MARKER
    )}, ${JSON.stringify(MAX_TEXT_CHARS)});`;

    try {
      const result = webview.executeJavaScript(script, true);
      if (result && typeof result.catch === "function") {
        result.catch(() => undefined);
      }
    } catch {
      // A página pode ter sido destruída/navegada durante a injeção.
    }
  }

  private handleConsoleMessage(event: Event): void {
    if (!this.active) return;

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

    const index = message.indexOf(COPY_MARKER);
    if (index === -1) return;

    try {
      const data = JSON.parse(
        message.slice(index + COPY_MARKER.length)
      ) as {
        text?: unknown;
        url?: unknown;
        title?: unknown;
      };

      const text = safeString(data.text);
      if (!text.trim()) return;

      this.rememberWebCopy({
        text: text.slice(0, MAX_TEXT_CHARS),
        url: safeString(data.url),
        title: safeString(data.title),
        at: Date.now(),
      });
    } catch {
      // Mensagem de console não relacionada ou payload inválido.
    }
  }

  private handleHostCopy(): void {
    if (!this.active) return;

    const activeView = this.app.workspace.activeLeaf?.view;
    const isReaderWebviewer =
      activeView?.getViewType() === WEBVIEWER_VIEW_TYPE &&
      (activeView as unknown as WebviewerViewLike).mode === "reader";

    if (!isReaderWebviewer) {
      this.lastWebCopy = null;
      return;
    }

    const text = document.getSelection()?.toString() ?? "";
    if (!text.trim()) {
      this.lastWebCopy = null;
      return;
    }

    this.rememberWebCopy(
      this.webCopyFromView(
        activeView as unknown as WebviewerViewLike,
        text
      )
    );
  }

  private rememberWebCopy(copy: WebCopy): void {
    if (!copy.text.trim()) return;
    this.lastWebCopy = copy;
    this.app.workspace.trigger(WEB_COPY_EVENT, copy);
  }

  // ---------------------------------------------------------------------
  // Menu de contexto do Web viewer
  // ---------------------------------------------------------------------

  private decorateContextMenu(
    view: WebviewerViewLike,
    items: MenuItemLike[],
    selectionText: string
  ): MenuItemLike[] {
    const text = safeString(selectionText);
    if (!text.trim()) return items;

    const copy = this.webCopyFromView(view, text);
    const isReader = view.mode === "reader";
    const copyIndex = items.findIndex(
      (item) => item && item.role === "copy"
    );

    if (copyIndex !== -1 && !isReader) {
      // Mantém o item nativo "Copiar" funcionando e registra a seleção
      // exata do menu, sem depender do evento copy do convidado.
      const copyItem = items[copyIndex];
      delete copyItem.role;
      copyItem.click = () => {
        this.rememberWebCopy(copy);
        try {
          view.webview?.copy?.();
        } catch (error) {
          console.error(
            "Webview Text Selector: falha ao copiar seleção",
            error
          );
        }
      };
    }

    const citeItem: MenuItemLike = {
      label: MENU_ITEM_LABEL,
      click: () => {
        this.rememberWebCopy(copy);
        this.insertCitation(copy);
      },
    };

    items.splice(
      copyIndex !== -1 ? copyIndex + 1 : items.length,
      0,
      citeItem
    );

    return items;
  }

  private webCopyFromView(
    view: WebviewerViewLike,
    text: string
  ): WebCopy {
    const webview = view.webview;

    let url = "";
    let title = "";

    try {
      url = safeString(webview?.getURL?.());
    } catch {
      // Webview destruída durante a leitura.
    }

    if (!url) url = safeString(view.url);

    try {
      title = safeString(webview?.getTitle?.());
    } catch {
      // Webview destruída durante a leitura.
    }

    if (!title) title = safeString(view.title);

    return {
      text: text.slice(0, MAX_TEXT_CHARS),
      url: url.trim(),
      title: title.trim() || url.trim(),
      at: Date.now(),
    };
  }

  // ---------------------------------------------------------------------
  // Colagem na nota
  // ---------------------------------------------------------------------

  private handleEditorPaste(
    evt: ClipboardEvent,
    editor: Editor,
    info: unknown
  ): void {
    if (!this.active || evt.defaultPrevented) return;

    const copy = this.lastWebCopy;
    if (!copy) return;

    const clipboardText =
      evt.clipboardData?.getData("text/plain") ?? "";
    if (!clipboardText.trim()) return;
    if (!sameText(clipboardText, copy.text)) return;

    evt.preventDefault();

    const noteName = (
      info as { file?: { basename?: string } | null } | null
    )?.file?.basename;

    this.insertCitation(copy, editor, noteName);
  }

  private insertCitation(
    copy: WebCopy,
    editor?: Editor,
    noteName?: string
  ): void {
    const target = editor ?? this.getTargetEditor();
    if (!target) {
      new Notice(
        "Abra uma nota em Markdown para inserir a citação."
      );
      return;
    }

    const citation = formatCitation(copy);

    try {
      target.replaceSelection(this.withSurroundingBreaks(target, citation));
      new Notice(
        noteName
          ? `Citação inserida em "${noteName}".`
          : "Citação inserida na nota."
      );
    } catch (error) {
      console.error(
        "Webview Text Selector: falha ao inserir citação",
        error
      );
      new Notice("Não foi possível inserir a citação na nota.");
    }
  }

  /**
   * Garante que o bloco de citação comece e termine em linhas próprias
   * quando o cursor está no meio de um parágrafo.
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

  private getTargetEditor(): Editor | null {
    const active = this.app.workspace.getActiveViewOfType(MarkdownView);
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

  private getWebviewerView(): WebviewerViewLike | null {
    const active = this.app.workspace.activeLeaf?.view;
    if (active && active.getViewType() === WEBVIEWER_VIEW_TYPE) {
      return active as unknown as WebviewerViewLike;
    }

    const leaves = this.app.workspace.getLeavesOfType(
      WEBVIEWER_VIEW_TYPE
    );

    const tracked = this.lastWebviewerView;
    if (tracked && leaves.some((leaf) => leaf.view === tracked)) {
      return tracked;
    }

    return leaves.length > 0
      ? (leaves[leaves.length - 1].view as unknown as WebviewerViewLike)
      : null;
  }

  /**
   * Comando de apoio: lê a seleção atual direto do Web viewer (incluindo
   * o modo leitor) e insere a citação na última nota Markdown ativa.
   */
  private async citeCurrentSelection(): Promise<void> {
    const view = this.getWebviewerView();
    if (!view) {
      new Notice("Abra uma página no Web viewer nativo.");
      return;
    }

    let text = "";

    if (view.mode === "reader") {
      text = document.getSelection()?.toString() ?? "";
    } else {
      const webview = view.webview;
      if (!webview?.executeJavaScript) {
        new Notice("O Web viewer ainda não terminou de carregar.");
        return;
      }

      try {
        const result = await webview.executeJavaScript(
          "window.getSelection().toString()",
          true
        );
        text = safeString(result);
      } catch (error) {
        console.error(
          "Webview Text Selector: falha ao ler a seleção",
          error
        );
      }
    }

    if (!text.trim()) {
      new Notice("Selecione um texto no Web viewer nativo.");
      return;
    }

    const copy = this.webCopyFromView(view, text);
    this.rememberWebCopy(copy);
    this.insertCitation(copy);
  }
}
