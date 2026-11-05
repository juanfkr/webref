import type { App, WorkspaceLeaf } from "obsidian";
import type { WebCopyStore } from "../citation/WebCopyStore";
import type { WebviewCopyChannel } from "./WebviewCopyChannel";
import type { WebviewerMenuDecorator } from "./WebviewerMenuDecorator";
import type { WebviewerPage } from "./WebviewerPage";
import { WebviewerPatcher } from "./WebviewerPatcher";
import { WebviewerRegistry } from "./WebviewerRegistry";

/**
 * Facade for the native Web viewer integration.
 *
 * Coordinates the registry of open views and the application of patches,
 * keeping the rest of the plugin independent from Obsidian's internal details.
 */
export class NativeWebviewerService {
  private readonly registry: WebviewerRegistry;
  private readonly patcher: WebviewerPatcher;

  /**
   * @param app Obsidian application.
   * @param store Storage for the latest copy.
   * @param menuDecorator Context menu decorator.
   * @param copyChannel Page capture channel.
   */
  constructor(
    app: App,
    private readonly store: WebCopyStore,
    menuDecorator: WebviewerMenuDecorator,
    copyChannel: WebviewCopyChannel
  ) {
    this.registry = new WebviewerRegistry(app);
    this.patcher = new WebviewerPatcher(menuDecorator, copyChannel);
  }

  /** Starts monitoring open Web viewers. */
  start(): void {
    this.scan();
    this.registry.observe(() => this.scan());
  }

  /** Removes listeners, observers, and patches applied to views. */
  stop(): void {
    this.registry.stop();
    this.patcher.stop();
  }

  /**
   * Remembers the last Web viewer view that received focus.
   *
   * @param leaf Leaf that is active at the moment.
   */
  trackLeaf(leaf: WorkspaceLeaf | null): void {
    this.registry.trackLeaf(leaf);
  }

  /**
   * Returns the active Web viewer or the last one used.
   *
   * @returns The page found, or `null` when no Web viewer is open.
   */
  getCurrentPage(): WebviewerPage | null {
    return this.registry.getCurrentPage();
  }

  /**
   * Finds and prepares every open Web viewer view.
   *
   * Can be called as often as needed; already prepared views are simply checked
   * again.
   */
  scan(): void {
    for (const page of this.registry.findAll()) {
      this.patcher.patch(page);
    }
  }

  /**
   * Handles copies made in the Obsidian document.
   *
   * Outside reader mode, any copy in the application invalidates the previous
   * capture. In reader mode the selection lives in the Obsidian document, so it
   * is recorded here.
   */
  handleHostCopy(): void {
    const page = this.registry.getActivePage();
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
}
