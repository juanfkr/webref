/**
 * Converte um valor desconhecido em string segura.
 *
 * Útil ao ler dados vindos da página, onde qualquer valor pode chegar por
 * `console-message` ou por APIs internas do Obsidian.
 *
 * @param value Valor a converter.
 * @returns O próprio valor quando já é string; caso contrário, string vazia.
 */
export function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * Verifica se uma string possui conteúdo visível.
 *
 * @param value Texto a verificar.
 */
export function hasVisibleText(value: string): boolean {
  return value.trim().length > 0;
}

/**
 * Normaliza diferenças de espaço em branco entre `window.getSelection()` e o
 * `text/plain` colocado na área de transferência pelo Chromium.
 *
 * @param value Texto original.
 * @returns Texto sem espaços repetidos, sem caracteres invisíveis comuns e sem
 * espaços nas extremidades.
 */
export function normalizeForComparison(value: string): string {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/[\u200b-\u200d\ufeff]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Compara o texto capturado no Web viewer com o texto que o usuário colou.
 *
 * A primeira comparação ignora apenas diferenças de espaço em branco. Se ela
 * falhar, uma segunda comparação ignora também as quebras de linha inseridas
 * pelo Chromium ao montar o `text/plain` entre blocos HTML.
 *
 * @param left Primeiro texto.
 * @param right Segundo texto.
 */
export function isSameText(left: string, right: string): boolean {
  const normalizedLeft = normalizeForComparison(left);
  const normalizedRight = normalizeForComparison(right);

  if (!normalizedLeft || !normalizedRight) return false;
  if (normalizedLeft === normalizedRight) return true;

  return (
    normalizedLeft.replace(/\s/g, "") ===
    normalizedRight.replace(/\s/g, "")
  );
}
