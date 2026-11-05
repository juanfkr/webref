/**
 * Subconjunto da tag <webview> do Electron usado pelo Web viewer nativo.
 *
 * Os métodos abaixo não fazem parte do tipo padrão do DOM e só existem no
 * elemento criado pelo Obsidian no desktop.
 */
export interface WebviewElementLike extends HTMLElement {
  /**
   * Executa JavaScript dentro da página carregada.
   *
   * @param code Código a executar no convidado.
   * @param userGesture Simula um gesto do usuário, quando necessário.
   */
  executeJavaScript?: (
    code: string,
    userGesture?: boolean
  ) => Promise<unknown>;

  /** Retorna a URL atual da página. */
  getURL?: () => string;

  /** Retorna o título atual da página. */
  getTitle?: () => string;

  /** Copia a seleção atual do convidado para a área de transferência. */
  copy?: () => void;

  /** Indica se a página ainda está carregando. */
  isLoading?: () => boolean;
}

/** Item do template de menu nativo aceito pelo Electron. */
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
 * `contextMenuItemsForSelection` e `instantiateWebView` são APIs internas do
 * Obsidian. O plugin faz feature detection antes de usá-las, então o fluxo de
 * copiar/colar continua funcionando mesmo se elas mudarem.
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
