import type { WebCopy } from "./WebCopy";

/**
 * Guarda a última cópia feita no Web viewer nativo.
 *
 * Também permite que outros componentes sejam avisados quando uma nova
 * captura é registrada, sem precisar conhecer quem a produziu.
 */
export class WebCopyStore {
  private current: WebCopy | null = null;
  private readonly rememberListeners = new Set<
    (copy: WebCopy) => void
  >();

  /**
   * Retorna a última cópia registrada.
   *
   * @returns A cópia mais recente ou `null` quando não há nenhuma.
   */
  getCurrent(): WebCopy | null {
    return this.current;
  }

  /**
   * Registra uma nova cópia e avisa os interessados.
   *
   * Capturas sem texto visível são ignoradas para não apagar uma cópia válida
   * com uma seleção vazia acidental.
   *
   * @param copy Cópia a registrar.
   */
  remember(copy: WebCopy): void {
    if (!copy.hasText()) return;

    this.current = copy;

    for (const listener of this.rememberListeners) {
      listener(copy);
    }
  }

  /** Descarta a cópia atual. */
  clear(): void {
    this.current = null;
  }

  /**
   * Registra um observador para novas cópias.
   *
   * @param listener Função chamada sempre que uma cópia válida é registrada.
   * @returns Função para cancelar a inscrição.
   */
  onRemember(listener: (copy: WebCopy) => void): () => void {
    this.rememberListeners.add(listener);
    return () => {
      this.rememberListeners.delete(listener);
    };
  }
}
