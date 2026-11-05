import type { WebCopy } from "./WebCopy";

/**
 * Stores the latest copy made in the native Web viewer.
 *
 * It also lets other components be notified when a new capture is recorded,
 * without needing to know who produced it.
 */
export class WebCopyStore {
  private current: WebCopy | null = null;
  private readonly rememberListeners = new Set<
    (copy: WebCopy) => void
  >();

  /**
   * Returns the latest recorded copy.
   *
   * @returns The most recent copy, or `null` when there is none.
   */
  getCurrent(): WebCopy | null {
    return this.current;
  }

  /**
   * Records a new copy and notifies interested listeners.
   *
   * Captures without visible text are ignored so an accidental empty selection
   * does not erase a valid copy.
   *
   * @param copy Copy to record.
   */
  remember(copy: WebCopy): void {
    if (!copy.hasText()) return;

    this.current = copy;

    for (const listener of this.rememberListeners) {
      listener(copy);
    }
  }

  /** Discards the current copy. */
  clear(): void {
    this.current = null;
  }

  /**
   * Registers an observer for new copies.
   *
   * @param listener Function called whenever a valid copy is recorded.
   * @returns Function that cancels the subscription.
   */
  onRemember(listener: (copy: WebCopy) => void): () => void {
    this.rememberListeners.add(listener);
    return () => {
      this.rememberListeners.delete(listener);
    };
  }
}
