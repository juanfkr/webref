# Webview Text Selector

Plugin para **Obsidian desktop** que transforma texto copiado do **Web viewer nativo** em uma citação formatada na nota.

O plugin não abre um navegador próprio: ele se integra ao Web viewer que já vem no Obsidian (`viewType: "webviewer"`).

## Como usar

### 1. Copiar e colar

1. Abra uma página no **Web viewer nativo** do Obsidian.
2. Selecione o texto desejado e pressione `Ctrl+C` (`Cmd+C` no macOS).
3. Vá para a nota e pressione `Ctrl+V` (`Cmd+V`).

Em vez do texto puro, o plugin insere:

```markdown
> primeira linha da citação
> segunda linha da citação
>
> [Título da página](<https://exemplo.com/pagina>)
```

O rodapé contém **apenas o hyperlink formatado**, sem data nem hora.

### 2. Menu de contexto do Web viewer

1. Selecione o texto no Web viewer nativo.
2. Clique com o botão direito.
3. Escolha **Inserir citação na nota**.

A citação é inserida no cursor da última nota Markdown ativa.

> O item também aparece no modo leitor do Web viewer nativo.

### Comando opcional

A paleta de comandos oferece:

- **Webview Text Selector: Inserir citação da seleção atual do Web viewer**

Ele lê a seleção diretamente do Web viewer (inclusive no modo leitor) e insere na última nota ativa. Pode ser usado para criar um atalho.

## Formato da citação

- Cada linha do texto selecionado recebe o prefixo `>`.
- Uma linha `>` em branco separa o texto da fonte.
- A fonte é um link Markdown com o título da página e a URL entre `<...>`.
- Não há data, hora, travessão ou texto adicional no rodapé.
- Se o cursor estiver no meio de um parágrafo, o plugin adiciona quebras de linha para o bloco começar e terminar em linhas próprias.

## Instalação manual

```bash
npm install
npm run build
```

Copie `main.js` e `manifest.json` para:

```
<SeuVault>/.obsidian/plugins/webview-text-selector/
```

Depois ative o plugin em **Configurações → Plugins da comunidade**.

Ou use o script, que compila e copia os arquivos:

```bash
./install.sh /caminho/do/seu/vault
```

Para desenvolver, crie um link simbólico da pasta do projeto dentro de
`.obsidian/plugins/` e rode `npm run dev` para rebuild automático.

## Requisitos

- Obsidian desktop 1.8.0 ou superior, com o **Web viewer** nativo habilitado.
- Não funciona no Obsidian mobile.

## Como funciona

O Web viewer nativo cria um `<webview>` do Electron e o expõe como `leaf.view.webview`. O Obsidian força `sandbox` e remove preloads, então não há `ipcRenderer` disponível na página.

Para capturar o texto:

1. No evento `dom-ready` de cada `<webview>`, o plugin injeta um pequeno script com `executeJavaScript()`.
2. O script escuta o evento `copy` (e `Ctrl+C` como reforço), lê `window.getSelection()` — ou `selectionStart/End` de inputs e textareas — e envia o texto ao host por `console.log` com um marcador fixo.
3. O host escuta `console-message` e guarda a última cópia do Web viewer.
4. Ao colar em uma nota, o evento `editor-paste` do Obsidian compara o texto da área de transferência com a última cópia (ignorando diferenças de espaços/quebras) e, se bater, chama `preventDefault()` e insere a citação formatada.

Para o item de menu:

- O plugin envolve `view.contextMenuItemsForSelection()` — API interna do Web viewer — para acrescentar **Inserir citação na nota**.
- Se essa API mudar em uma versão futura do Obsidian, o fluxo de copiar/colar e o comando da paleta continuam funcionando.

A captura é invalidada quando você copia ou recorta algo fora do Web viewer, evitando que uma cópia antiga interfira em colagens comuns.

## Limitações

- Depende do Web viewer nativo e de APIs internas do Obsidian para o item de menu.
- Texto selecionado dentro de **iframes** não é capturado (o script é injetado apenas no frame principal).
- Se um site alterar o conteúdo da área de transferência ao copiar (por exemplo, acrescentando atribuição), a comparação pode falhar e a colagem cai no comportamento normal.
- O plugin só intercepta colagens em editores Markdown.

## Estrutura

```
.
├── manifest.json
├── esbuild.config.mjs
├── install.sh
├── src
│   ├── main.ts   # integração com o Web viewer, captura, menu e citação
│   └── types.ts  # tipos da integração
└── versions.json
```
