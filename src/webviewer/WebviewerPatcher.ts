import type {
  MenuItemLike,
  WebviewElementLike,
  WebviewerViewLike,
} from "../shared/types";
import type { WebviewCopyChannel } from "./WebviewCopyChannel";
import type { WebviewerMenuDecorator } from "./WebviewerMenuDecorator";
import type { WebviewerPage } from "./WebviewerPage";

/**
 * Aplica os patches necessários nas views do Web viewer nativo.
 *
 * Os métodos internos do Obsidian são envolvidos uma única vez por view. O
 * patch é reversível para que o plugin possa ser descarregado sem deixar
 * funções apontando para uma instância antiga.
 */
export class WebviewerPatcher {
  private active = true;

  private readonly patchedViews = new WeakSet<object>();
  private patches: Array<{ restore: () => void }> = [];

  private readonly connectedWebviews =
    new WeakSet<WebviewElementLike>();
  private readonly cleanups = new Set<() => void>();

  /**
   * @param menuDecorator Decorador do menu de contexto.
   * @param copyChannel Canal de captura das páginas.
   */
  constructor(
    private readonly menuDecorator: WebviewerMenuDecorator,
    private readonly copyChannel: WebviewCopyChannel
  ) {}

  /**
   * Prepara uma view e conecta o `<webview>` atual.
   *
   * @param page Página a preparar.
   */
  patch(page: WebviewerPage): void {
    if (!this.active) return;

    this.patchViewMethods(page);
    this.hookWebview(page);
  }

  /** Remove listeners e restaura os métodos originais das views. */
  stop(): void {
    this.active = false;

    for (const cleanup of this.cleanups) {
      try {
        cleanup();
      } catch {
        // Ignora falhas ao remover listeners de webviews já destruídos.
      }
    }
    this.cleanups.clear();

    for (const patch of this.patches) {
      try {
        patch.restore();
      } catch {
        // Ignora falhas ao restaurar métodos de views já descartadas.
      }
    }
    this.patches = [];
  }

  /**
   * Envolve os métodos internos da view, quando disponíveis.
   *
   * @param page Página cujos métodos serão envolvidos.
   */
  private patchViewMethods(page: WebviewerPage): void {
    const view = page.view;
    if (this.patchedViews.has(view)) return;

    this.patchedViews.add(view);

    const restoreCallbacks: Array<() => void> = [];

    if (typeof view.instantiateWebView === "function") {
      restoreCallbacks.push(
        this.patchInstantiateWebView(view, page)
      );
    }

    if (typeof view.contextMenuItemsForSelection === "function") {
      restoreCallbacks.push(
        this.patchContextMenu(view, page)
      );
    }

    this.patches.push({
      restore: () => {
        for (const restore of restoreCallbacks) restore();
      },
    });
  }

  /**
   * Garante que webviews recriados pelo Obsidian sejam conectados de novo.
   *
   * @param view View interna do Web viewer.
   * @param page Página correspondente.
   * @returns Função que restaura o método original.
   */
  private patchInstantiateWebView(
    view: WebviewerViewLike,
    page: WebviewerPage
  ): () => void {
    const original = view.instantiateWebView;
    if (!original) return () => undefined;

    const wrapper = (...args: unknown[]): unknown => {
      const result = original.apply(view, args);
      this.hookWebview(page);
      return result;
    };

    view.instantiateWebView = wrapper;

    return () => {
      if (view.instantiateWebView === wrapper) {
        view.instantiateWebView = original;
      }
    };
  }

  /**
   * Acrescenta a ação de citação ao menu de contexto nativo.
   *
   * @param view View interna do Web viewer.
   * @param page Página correspondente.
   * @returns Função que restaura o método original.
   */
  private patchContextMenu(
    view: WebviewerViewLike,
    page: WebviewerPage
  ): () => void {
    const original = view.contextMenuItemsForSelection;
    if (!original) return () => undefined;

    const wrapper = (
      selectionText: string,
      isEditable?: boolean
    ): MenuItemLike[] => {
      const items = original.call(view, selectionText, isEditable);

      return this.menuDecorator.decorate(
        page,
        Array.isArray(items) ? items : [],
        selectionText
      );
    };

    view.contextMenuItemsForSelection = wrapper;

    return () => {
      if (view.contextMenuItemsForSelection === wrapper) {
        view.contextMenuItemsForSelection = original;
      }
    };
  }

  /**
   * Conecta o canal de cópia ao `<webview>` atual da página.
   *
   * @param page Página cujo webview será conectado.
   */
  private hookWebview(page: WebviewerPage): void {
    if (!this.active) return;

    const webview = page.webview;
    if (!webview) return;
    if (this.connectedWebviews.has(webview)) return;

    this.connectedWebviews.add(webview);
    this.cleanups.add(this.copyChannel.connect(webview));
  }
}
