import type { App, WorkspaceLeaf } from "obsidian";
import type { WebviewerViewLike } from "../shared/types";
import { WEBVIEWER_VIEW_TYPE } from "./constants";
import { WebviewerPage } from "./WebviewerPage";

/**
 * Locates and keeps track of native Web viewer views.
 *
 * This class never modifies a view: it only discovers which ones are open,
 * which was used last, and when a new `<webview>` appears in the document.
 */
export class WebviewerRegistry {
  private observer: MutationObserver | null = null;
  private lastPage: WebviewerPage | null = null;

  /**
   * @param app Obsidian application.
   */
  constructor(private readonly app: App) {}

  /**
   * Remembers the last Web viewer view that received focus.
   *
   * @param leaf Leaf that is active at the moment.
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
   * Lists every open Web viewer view.
   *
   * @returns A wrapped page for each view found.
   */
  findAll(): WebviewerPage[] {
    const pages: WebviewerPage[] = [];

    for (const leaf of this.app.workspace.getLeavesOfType(
      WEBVIEWER_VIEW_TYPE
    )) {
      const view = leaf.view as unknown as WebviewerViewLike;
      if (view) pages.push(new WebviewerPage(view));
    }

    return pages;
  }

  /**
   * Returns the active Web viewer or the last one used.
   *
   * @returns The page found, or `null` when no Web viewer is open.
   */
  getCurrentPage(): WebviewerPage | null {
    const active = this.getActivePage();
    if (active) return active;

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
   * Returns the page only when the Web viewer is actually active.
   *
   * @returns The active page or `null`.
   */
  getActivePage(): WebviewerPage | null {
    const view = this.app.workspace.activeLeaf?.view;
    if (view?.getViewType() !== WEBVIEWER_VIEW_TYPE) return null;

    return new WebviewerPage(
      view as unknown as WebviewerViewLike
    );
  }

  /**
   * Watches the document for new `<webview>` elements.
   *
   * The observer covers cases where a view is mounted without a noticeable
   * layout change. Workspace events are still used by the main service as a
   * reinforcement.
   *
   * @param onWebviewAdded Called when a new `<webview>` is inserted.
   */
  observe(onWebviewAdded: () => void): void {
    if (this.observer || !document.body) return;

    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of Array.from(mutation.addedNodes)) {
          if (!(node instanceof HTMLElement)) continue;

          if (
            node.tagName === "WEBVIEW" ||
            node.querySelector?.("webview")
          ) {
            onWebviewAdded();
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

  /** Stops watching the document. */
  stop(): void {
    this.observer?.disconnect();
    this.observer = null;
    this.lastPage = null;
  }
}
