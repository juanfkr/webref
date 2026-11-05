/** Tipo interno da view do Web viewer nativo do Obsidian. */
export const WEBVIEWER_VIEW_TYPE = "webviewer";

/**
 * Marcador fixo do canal `console-message`.
 *
 * É intencionalmente fixo (e não um nonce por sessão): se o plugin for
 * recarregado, o script já injetado na página continua enviando cópias e a
 * nova instância do plugin consegue recebê-las.
 */
export const COPY_MARKER = "[[WEBVIEW_TEXT_SELECTOR_COPY]]";

/** Teto de segurança para o texto vindo da página. */
export const MAX_TEXT_CHARS = 200_000;

/** Texto do item adicionado ao menu de contexto do Web viewer. */
export const MENU_ITEM_LABEL = "Inserir citação na nota";
