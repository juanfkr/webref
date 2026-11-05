import type {
  MenuItemLike,
  WebviewElementLike,
  WebviewerViewLike,
} from "../shared/types";
import type { WebviewCopyChannel } from "./WebviewCopyChannel";
import type { WebviewerMenuDecorator } from "./WebviewerMenuDecorator";
import type { WebviewerPage } from "./WebviewerPage";

/**
 * Applies the necessary patches to native Web viewer views.
 *
 * Obsidian's internal methods are wrapped once per view. The patch is
 * reversible so the plugin can be unloaded without leaving functions pointing
 * to an old instance.
 */
export class WebviewerPatcher {
  private active = true;

  private readonly patchedViews = new WeakSet<object>();
  private patches: Array<{ restore: () => void }> = [];

  private readonly connectedWebviews =
    new WeakSet<WebviewElementLike>();
  private readonly cleanups = new Set<() => void>();

  /**
   * @param menuDecorator Context menu decorator.
   * @param copyChannel Page capture channel.
   */
  constructor(
    private readonly menuDecorator: WebviewerMenuDecorator,
    private readonly copyChannel: WebviewCopyChannel
  ) {}

  /**
   * Prepares a view and connects the current `<webview>`.
   *
   * @param page Page to prepare.
   */
  patch(page: WebviewerPage): void {
    if (!this.active) return;

    this.patchViewMethods(page);
    this.hookWebview(page);
  }

  /** Removes listeners and restores the views' original methods. */
  stop(): void {
    this.active = false;

    for (const cleanup of this.cleanups) {
      try {
        cleanup();
      } catch {
        // Ignore failures while removing listeners from destroyed webviews.
      }
    }
    this.cleanups.clear();

    for (const patch of this.patches) {
      try {
        patch.restore();
      } catch {
        // Ignore failures while restoring methods of discarded views.
      }
    }
    this.patches = [];
  }

  /**
   * Wraps the view's internal methods when available.
   *
   * @param page Page whose methods will be wrapped.
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
   * Ensures webviews recreated by Obsidian are connected again.
   *
   * @param view Internal Web viewer view.
   * @param page Corresponding page.
   * @returns Function that restores the original method.
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
   * Adds the citation action to the native context menu.
   *
   * @param view Internal Web viewer view.
   * @param page Corresponding page.
   * @returns Function that restores the original method.
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
   * Connects the copy channel to the page's current `<webview>`.
   *
   * @param page Page whose webview will be connected.
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
