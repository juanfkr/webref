import type { App, WorkspaceLeaf } from "obsidian";
import type { WebviewerViewLike } from "../shared/types";
import { WEBVIEWER_VIEW_TYPE } from "./constants";
import { WebviewerPage } from "./WebviewerPage";

/**
 * Localiza e acompanha as views do Web viewer nativo.
 *
 * Esta classe não altera nenhuma view: apenas descobre quais estão abertas,
 * qual foi a última utilizada e quando um novo `<webview>` aparece no
 * documento.
 */
export class WebviewerRegistry {
  private observer: MutationObserver | null = null;
  private lastPage: WebviewerPage | null = null;

  /**
   * @param app Aplicativo do Obsidian.
   */
  constructor(private readonly app: App) {}

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
   * Lista todas as views do Web viewer abertas.
   *
   * @returns Uma página encapsulada para cada view encontrada.
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
   * Retorna o Web viewer ativo ou o último utilizado.
   *
   * @returns A página encontrada ou `null` quando não há Web viewer aberto.
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
   * Retorna a página somente quando o Web viewer está realmente ativo.
   *
   * @returns A página ativa ou `null`.
   */
  getActivePage(): WebviewerPage | null {
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
   * reforço pelo serviço principal.
   *
   * @param onWebviewAdded Chamada quando um novo `<webview>` é inserido.
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

  /** Interrompe a observação do documento. */
  stop(): void {
    this.observer?.disconnect();
    this.observer = null;
    this.lastPage = null;
  }
}
