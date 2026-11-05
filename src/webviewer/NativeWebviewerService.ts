import type { App, WorkspaceLeaf } from "obsidian";
import type { WebCopyStore } from "../citation/WebCopyStore";
import type {
  MenuItemLike,
  WebviewElementLike,
  WebviewerViewLike,
} from "../shared/types";
import { WEBVIEWER_VIEW_TYPE } from "./constants";
import type { WebviewCopyChannel } from "./WebviewCopyChannel";
import type { WebviewerMenuDecorator } from "./WebviewerMenuDecorator";
import { WebviewerPage } from "./WebviewerPage";

/**
 * Acompanha as views do Web viewer nativo e mantém a integração ativa.
 *
 * Responsabilidades:
 * - encontrar Web viewers já abertos e os que forem criados depois;
 * - conectar o canal de cópia a cada `<webview>`;
 * - decorar o menu de contexto;
 * - restaurar os métodos originais ao descarregar o plugin.
 */
export class NativeWebviewerService {
  private active = true;
  private observer: MutationObserver | null = null;

  private readonly patchedViews = new WeakSet<object>();
  private patches: Array<{ restore: () => void }> = [];

  private readonly connectedWebviews =
    new WeakSet<WebviewElementLike>();
  private readonly cleanups = new Set<() => void>();

  private lastPage: WebviewerPage | null = null;

  /**
   * @param app Aplicativo do Obsidian.
   * @param store Armazenamento da última cópia.
   * @param menuDecorator Decorador do menu de contexto.
   * @param copyChannel Canal de captura das páginas.
   */
  constructor(
    private readonly app: App,
    private readonly store: WebCopyStore,
    private readonly menuDecorator: WebviewerMenuDecorator,
    private readonly copyChannel: WebviewCopyChannel
  ) {}

  /** Inicia o monitoramento dos Web viewers abertos. */
  start(): void {
    this.active = true;
    this.scan();
    this.observe();
  }

  /** Remove listeners, observers e patches aplicados às views. */
  stop(): void {
    this.active = false;

    this.observer?.disconnect();
    this.observer = null;

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

    this.lastPage = null;
  }

  /**
   * Lembra a última view do Web viewer que recebeu o foco.
   *
   * @param leaf Leaf ativa no momento.
   */
  trackLeaf(leaf: WorkspaceLeaf | null): void {
    const view = leaf?.view;
    if (view?.getViewType() === WEBVIEWER_VIEW_TYPE) {
      this.lastPage = new WebviewerPage(
        view as unknown as WebviewerViewLike
      );
    }
  }

  /**
   * Retorna o Web viewer ativo ou o último utilizado.
   *
   * @returns A página encontrada ou `null` quando não há Web viewer aberto.
   */
  getCurrentPage(): WebviewerPage | null {
    const active = this.app.workspace.activeLeaf?.view;
    if (active?.getViewType() === WEBVIEWER_VIEW_TYPE) {
      return new WebviewerPage(
        active as unknown as WebviewerViewLike
      );
    }

    const leaves = this.app.workspace.getLeavesOfType(
      WEBVIEWER_VIEW_TYPE
    );

    const tracked = this.lastPage;
    if (
      tracked &&
      leaves.some((leaf) => leaf.view === tracked.view)
    ) {
      return tracked;
    }

    return leaves.length > 0
      ? new WebviewerPage(
          leaves[leaves.length - 1].view as unknown as WebviewerViewLike
        )
      : null;
  }

  /**
   * Encontra e prepara todas as views do Web viewer abertas.
   *
   * Pode ser chamado quantas vezes for necessário; views já preparadas são
   * apenas verificadas novamente.
   */
  scan(): void {
    if (!this.active) return;

    for (const leaf of this.app.workspace.getLeavesOfType(
      WEBVIEWER_VIEW_TYPE
    )) {
      const view = leaf.view as unknown as WebviewerViewLike;
      if (!view) continue;
      this.patchView(new WebviewerPage(view));
    }
  }

  /**
   * Trata cópias feitas no documento do Obsidian.
   *
   * Fora do modo leitor, qualquer cópia no aplicativo invalida a captura
   * anterior. No modo leitor a seleção fica no documento do Obsidian, então
   * ela é registrada aqui.
   */
  handleHostCopy(): void {
    if (!this.active) return;

    const page = this.getActivePage();
    if (!page || !page.isReaderMode) {
      this.store.clear();
      return;
    }

    const text = document.getSelection()?.toString() ?? "";
    if (!text.trim()) {
      this.store.clear();
      return;
    }

    this.store.remember(page.capture(text));
  }

  /** Retorna a página somente quando o Web viewer está realmente ativo. */
  private getActivePage(): WebviewerPage | null {
    const view = this.app.workspace.activeLeaf?.view;
    if (view?.getViewType() !== WEBVIEWER_VIEW_TYPE) return null;

    return new WebviewerPage(
      view as unknown as WebviewerViewLike
    );
  }

  /**
   * Observa o documento para descobrir novos elementos `<webview>`.
   *
   * O observer cobre os casos em que uma view é montada sem uma mudança de
   * layout perceptível. Os eventos do workspace continuam sendo usados como
   * reforço.
   */
  private observe(): void {
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
            this.scan();
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

  /**
   * Envolve os métodos internos da view e conecta o webview atual.
   *
   * @param page Página a preparar.
   */
  private patchView(page: WebviewerPage): void {
    const view = page.view;

    if (!this.patchedViews.has(view)) {
      this.patchedViews.add(view);

      const restoreCallbacks: Array<() => void> = [];

      if (typeof view.instantiateWebView === "function") {
        const original = view.instantiateWebView;

        const wrapper = (...args: unknown[]): unknown => {
          const result = original.apply(view, args);
          this.hookWebview(page);
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
          return this.menuDecorator.decorate(
            page,
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

    this.hookWebview(page);
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
