/**
 * Subset of Electron's <webview> tag used by the native Web viewer.
 *
 * The methods below are not part of the standard DOM type and only exist on
 * the element created by Obsidian on desktop.
 */
export interface WebviewElementLike extends HTMLElement {
  /**
   * Executes JavaScript inside the loaded page.
   *
   * @param code Code to run in the guest page.
   * @param userGesture Simulates a user gesture when needed.
   */
  executeJavaScript?: (
    code: string,
    userGesture?: boolean
  ) => Promise<unknown>;

  /** Returns the current page URL. */
  getURL?: () => string;

  /** Returns the current page title. */
  getTitle?: () => string;

  /** Copies the guest's current selection to the clipboard. */
  copy?: () => void;

  /** Indicates whether the page is still loading. */
  isLoading?: () => boolean;
}

/** Native menu template item accepted by Electron. */
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
 * Subset of the native Web viewer's internal view.
 *
 * `contextMenuItemsForSelection` and `instantiateWebView` are Obsidian internal
 * APIs. The plugin performs feature detection before using them, so the
 * copy/paste flow keeps working even if they change.
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
