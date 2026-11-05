import { Notice, Plugin } from "obsidian";
import { CitationFormatter } from "../citation/CitationFormatter";
import { CitationInserter } from "../citation/CitationInserter";
import { PasteInterceptor } from "../citation/PasteInterceptor";
import { WebCopyStore } from "../citation/WebCopyStore";
import { NativeWebviewerService } from "../webviewer/NativeWebviewerService";
import { WebviewCopyChannel } from "../webviewer/WebviewCopyChannel";
import { WebviewerMenuDecorator } from "../webviewer/WebviewerMenuDecorator";

/** Evento opcional para integrações com outros plugins. */
const WEB_COPY_EVENT = "webview-text-selector:web-copy";

/**
 * Plugin que transforma texto copiado do Web viewer nativo em citações.
 *
 * A classe apenas compõe os serviços especializados:
 * - `WebCopyStore` guarda a última cópia;
 * - `PasteInterceptor` transforma a colagem em citação;
 * - `CitationInserter` insere o bloco na nota;
 * - `NativeWebviewerService` integra-se ao Web viewer do Obsidian.
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

  /** Registra eventos, comando e inicia o monitoramento do Web viewer. */
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

    // Uma cópia feita fora do Web viewer invalida a captura anterior.
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

  /** Libera os serviços e restaura os métodos alterados no Obsidian. */
  onunload(): void {
    this.unsubscribeStore?.();
    this.unsubscribeStore = null;
    this.webviewer.stop();
  }

  /**
   * Lê a seleção atual do Web viewer e insere a citação na nota ativa.
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
