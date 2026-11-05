/** Texto capturado do Web viewer nativo, pronto para virar citação. */
export interface WebCopy {
  /** Texto selecionado na página. */
  text: string;
  /** URL da página no momento da cópia. */
  url: string;
  /** Título da página no momento da cópia. */
  title: string;
  /** Timestamp (ms) em que a cópia foi capturada. */
  at: number;
}

/**
 * Subconjunto da tag <webview> do Electron usado pelo Web viewer nativo.
 * Os métodos não fazem parte do tipo padrão do DOM.
 */
export interface WebviewElementLike extends HTMLElement {
  executeJavaScript?: (
    code: string,
    userGesture?: boolean
  ) => Promise<unknown>;
  getURL?: () => string;
  getTitle?: () => string;
  copy?: () => void;
  isLoading?: () => boolean;
}

/** Item do template de menu nativo do Electron. */
export interface MenuItemLike {
  type?: string;
  label?: string;
  role?: string;
  accelerator?: string;
  enabled?: boolean;
  click?: (...args: unknown[]) => void;
  [key: string]: unknown;
}

/**
 * Subconjunto da view interna do Web viewer nativo.
 *
 * `contextMenuItemsForSelection` e `instantiateWebView` são APIs internas:
 * o plugin faz feature detection antes de usá-las. O fluxo de copiar/colar
 * continua funcionando mesmo se elas mudarem.
 */
export interface WebviewerViewLike {
  url?: string;
  title?: string;
  mode?: string;
  webview?: WebviewElementLike;
  contextMenuItemsForSelection?: (
    selectionText: string,
    isEditable?: boolean
  ) => MenuItemLike[];
  instantiateWebView?: (...args: unknown[]) => unknown;
}
