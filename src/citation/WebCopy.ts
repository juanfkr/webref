/**
 * Texto selecionado no Web viewer nativo, junto com a origem da página.
 *
 * É um objeto imutável: uma vez capturado, o conteúdo não muda. Isso evita
 * que uma citação já montada seja alterada por engano.
 */
export class WebCopy {
  /**
   * @param text Texto selecionado na página.
   * @param url URL da página no momento da cópia.
   * @param title Título da página no momento da cópia.
   * @param capturedAt Momento da captura em milissegundos.
   */
  constructor(
    public readonly text: string,
    public readonly url: string,
    public readonly title: string,
    public readonly capturedAt: number = Date.now()
  ) {}

  /** Indica se a captura possui texto utilizável. */
  hasText(): boolean {
    return this.text.trim().length > 0;
  }
}
