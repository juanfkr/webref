import type { App, WorkspaceLeaf } from "obsidian";
import type { WebCopyStore } from "../citation/WebCopyStore";
import type { WebviewCopyChannel } from "./WebviewCopyChannel";
import type { WebviewerMenuDecorator } from "./WebviewerMenuDecorator";
import type { WebviewerPage } from "./WebviewerPage";
import { WebviewerPatcher } from "./WebviewerPatcher";
import { WebviewerRegistry } from "./WebviewerRegistry";

/**
 * Fachada da integração com o Web viewer nativo.
 *
 * Coordena o registro de views abertas e a aplicação dos patches, mantendo o
 * restante do plugin independente dos detalhes internos do Obsidian.
 */
export class NativeWebviewerService {
  private readonly registry: WebviewerRegistry;
  private readonly patcher: WebviewerPatcher;

  /**
   * @param app Aplicativo do Obsidian.
   * @param store Armazenamento da última cópia.
   * @param menuDecorator Decorador do menu de contexto.
   * @param copyChannel Canal de captura das páginas.
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

  /** Inicia o monitoramento dos Web viewers abertos. */
  start(): void {
    this.scan();
    this.registry.observe(() => this.scan());
  }

  /** Remove listeners, observers e patches aplicados às views. */
  stop(): void {
    this.registry.stop();
    this.patcher.stop();
  }

  /**
   * Lembra a última view do Web viewer que recebeu o foco.
   *
   * @param leaf Leaf ativa no momento.
   */
  trackLeaf(leaf: WorkspaceLeaf | null): void {
    this.registry.trackLeaf(leaf);
  }

  /**
   * Retorna o Web viewer ativo ou o último utilizado.
   *
   * @returns A página encontrada ou `null` quando não há Web viewer aberto.
   */
  getCurrentPage(): WebviewerPage | null {
    return this.registry.getCurrentPage();
  }

  /**
   * Encontra e prepara todas as views do Web viewer abertas.
   *
   * Pode ser chamado quantas vezes for necessário; views já preparadas são
   * apenas verificadas novamente.
   */
  scan(): void {
    for (const page of this.registry.findAll()) {
      this.patcher.patch(page);
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
