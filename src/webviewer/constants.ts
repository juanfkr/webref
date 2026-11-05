/** Internal view type of Obsidian's native Web viewer. */
export const WEBVIEWER_VIEW_TYPE = "webviewer";

/**
 * Fixed marker for the `console-message` channel.
 *
 * It is intentionally fixed (rather than a per-session nonce): if the plugin is
 * reloaded, the script already injected into the page keeps sending copies and
 * the new plugin instance can still receive them.
 */
export const COPY_MARKER = "[[WEBVIEW_TEXT_SELECTOR_COPY]]";

/** Safety cap for text coming from the page. */
export const MAX_TEXT_CHARS = 200_000;

/** Label of the item added to the Web viewer context menu. */
export const MENU_ITEM_LABEL = "Inserir citação na nota";
