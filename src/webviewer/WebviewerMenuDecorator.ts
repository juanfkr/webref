import type { CitationInserter } from "../citation/CitationInserter";
import type { WebCopyStore } from "../citation/WebCopyStore";
import { asString } from "../shared/text";
import type { MenuItemLike } from "../shared/types";
import { MENU_ITEM_LABEL } from "./constants";
import type { WebviewerPage } from "./WebviewerPage";

/**
 * Adds the citation action to the native Web viewer context menu.
 *
 * Obsidian's original menu is built by an internal API. The decorator receives
 * the finished items, preserves normal behavior, and adds only the new item.
 */
export class WebviewerMenuDecorator {
  /**
   * @param store Storage for the latest copy.
   * @param inserter Service that inserts the citation into the note.
   */
  constructor(
    private readonly store: WebCopyStore,
    private readonly inserter: CitationInserter
  ) {}

  /**
   * Decorates the context menu items.
   *
   * @param page Web viewer page that originated the menu.
   * @param items Original menu items.
   * @param selectionText Text selected at the time of the right-click.
   * @returns The same list with the citation item added.
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

    // In reader mode the selection lives in the Obsidian document. In that
    // case the native "Copy" item must stay untouched; the capture is done by
    // the host copy event instead.
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
