import { Notice, Plugin } from "obsidian";
import { CitationFormatter } from "../citation/CitationFormatter";
import { CitationInserter } from "../citation/CitationInserter";
import { PasteInterceptor } from "../citation/PasteInterceptor";
import { WebCopyStore } from "../citation/WebCopyStore";
import { NativeWebviewerService } from "../webviewer/NativeWebviewerService";
import { WebviewCopyChannel } from "../webviewer/WebviewCopyChannel";
import { WebviewerMenuDecorator } from "../webviewer/WebviewerMenuDecorator";

/** Optional event for integrations with other plugins. */
const WEB_COPY_EVENT = "webview-text-selector:web-copy";

/**
 * Plugin that turns text copied from the native Web viewer into citations.
 *
 * The class only composes the specialized services:
 * - `WebCopyStore` keeps the latest copy;
 * - `PasteInterceptor` turns pasting into a citation;
 * - `CitationInserter` inserts the block into the note;
 * - `NativeWebviewerService` integrates with Obsidian's Web viewer.
 */
export default class WebviewTextSelectorPlugin extends Plugin {
  private readonly copyStore = new WebCopyStore();

  private readonly inserter = new CitationInserter(
    this.app,
    new CitationFormatter()
  );

  private readonly pasteInterceptor = new PasteInterceptor(
    this.copyStore,
    this.inserter
  );

  private readonly webviewer = new NativeWebviewerService(
    this.app,
    this.copyStore,
    new WebviewerMenuDecorator(this.copyStore, this.inserter),
    new WebviewCopyChannel(this.copyStore)
  );

  private unsubscribeStore: (() => void) | null = null;

  /** Registers events and the command, then starts monitoring the Web viewer. */
  async onload(): Promise<void> {
    this.unsubscribeStore = this.copyStore.onRemember((copy) => {
      this.app.workspace.trigger(WEB_COPY_EVENT, copy);
    });

    this.registerEvent(
      this.app.workspace.on("editor-paste", (evt, editor, info) => {
        this.pasteInterceptor.handle(evt, editor, info);
      })
    );

    this.registerEvent(
      this.app.workspace.on("active-leaf-change", (leaf) => {
        this.inserter.trackLeaf(leaf);
        this.webviewer.trackLeaf(leaf);
        this.webviewer.scan();
      })
    );

    this.registerEvent(
      this.app.workspace.on("layout-change", () => {
        this.webviewer.scan();
      })
    );

    // A copy made outside the Web viewer invalidates the previous capture.
    this.registerDomEvent(
      document,
      "copy",
      () => {
        this.webviewer.handleHostCopy();
      },
      true
    );

    this.registerDomEvent(
      document,
      "cut",
      () => {
        this.copyStore.clear();
      },
      true
    );

    this.addCommand({
      id: "cite-web-viewer-selection",
      name: "Inserir citação da seleção atual do Web viewer",
      checkCallback: (checking) => {
        const available = this.webviewer.getCurrentPage() !== null;
        if (!available) return false;

        if (!checking) void this.citeCurrentSelection();
        return true;
      },
    });

    this.app.workspace.onLayoutReady(() => {
      this.inserter.trackActiveView();
      this.webviewer.trackLeaf(this.app.workspace.activeLeaf);
      this.webviewer.start();
    });
  }

  /** Releases the services and restores the methods changed in Obsidian. */
  onunload(): void {
    this.unsubscribeStore?.();
    this.unsubscribeStore = null;
    this.webviewer.stop();
  }

  /**
   * Reads the current selection from the Web viewer and inserts the citation
   * into the active note.
   */
  private async citeCurrentSelection(): Promise<void> {
    const page = this.webviewer.getCurrentPage();
    if (!page) {
      new Notice("Abra uma página no Web viewer nativo.");
      return;
    }

    if (!page.canReadSelection) {
      new Notice("O Web viewer ainda não terminou de carregar.");
      return;
    }

    const text = await page.readSelection();
    if (!text.trim()) {
      new Notice("Selecione um texto no Web viewer nativo.");
      return;
    }

    const copy = page.capture(text);
    this.copyStore.remember(copy);
    this.inserter.insert(copy);
  }
}
