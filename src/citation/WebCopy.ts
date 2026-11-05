import { hasVisibleText } from "../shared/text";

/**
 * Text selected in the native Web viewer, together with the page source.
 *
 * This is an immutable value object: once captured, its contents never change.
 * That prevents an already-built citation from being modified by accident.
 */
export class WebCopy {
  /**
   * @param text Text selected on the page.
   * @param url Page URL at the time of the copy.
   * @param title Page title at the time of the copy.
   * @param capturedAt Capture time in milliseconds.
   */
  constructor(
    public readonly text: string,
    public readonly url: string,
    public readonly title: string,
    public readonly capturedAt: number = Date.now()
  ) {}

  /** Whether the capture contains usable text. */
  hasText(): boolean {
    return hasVisibleText(this.text);
  }
}
