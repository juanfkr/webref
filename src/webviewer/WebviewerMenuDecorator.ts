import type { CitationInserter } from "../citation/CitationInserter";
import type { WebCopyStore } from "../citation/WebCopyStore";
import { asString } from "../shared/text";
import type { MenuItemLike } from "../shared/types";
import { MENU_ITEM_LABEL } from "./constants";
import type { WebviewerPage } from "./WebviewerPage";

/**
 * Acrescenta a ação de citação ao menu de contexto do Web viewer nativo.
 *
 * O menu original do Obsidian é montado por uma API interna. O decorador
 * recebe os itens já prontos, preserva o funcionamento normal e adiciona
 * apenas o novo item.
 */
export class WebviewerMenuDecorator {
  /**
   * @param store Armazenamento da última cópia.
   * @param inserter Serviço que insere a citação na nota.
   */
  constructor(
    private readonly store: WebCopyStore,
    private readonly inserter: CitationInserter
  ) {}

  /**
   * Decora os itens do menu de contexto.
   *
   * @param page Página do Web viewer que originou o menu.
   * @param items Itens originais do menu.
   * @param selectionText Texto selecionado no momento do clique direito.
   * @returns A mesma lista, com o item de citação acrescentado.
   */
  decorate(
    page: WebviewerPage,
    items: MenuItemLike[],
    selectionText: string
  ): MenuItemLike[] {
    const text = asString(selectionText);
    if (!text.trim()) return items;

    const copy = page.capture(text);
    const copyIndex = items.findIndex(
      (item) => item && item.role === "copy"
    );

    // No modo leitor a seleção está no documento do Obsidian. Nesse caso o
    // item nativo "Copiar" deve continuar intacto; a captura é feita pelo
    // evento copy do host.
    if (copyIndex !== -1 && !page.isReaderMode) {
      const copyItem = items[copyIndex];
      delete copyItem.role;
      copyItem.click = () => {
        this.store.remember(copy);
        page.copySelectionToClipboard();
      };
    }

    const citeItem: MenuItemLike = {
      label: MENU_ITEM_LABEL,
      click: () => {
        this.store.remember(copy);
        this.inserter.insert(copy);
      },
    };

    items.splice(
      copyIndex !== -1 ? copyIndex + 1 : items.length,
      0,
      citeItem
    );

    return items;
  }
}
