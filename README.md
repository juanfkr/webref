# Webview Text Selector

Transforme textos que você lê no **Web viewer** do Obsidian em citações prontas nas suas notas.

O plugin não abre outro navegador: ele usa o Web viewer que já faz parte do Obsidian.

## O que você ganha

- Copiou um texto no Web viewer? Ao colar na nota, ele vira uma citação formatada.
- Também dá para citar pelo botão direito, sem precisar copiar e colar.
- A citação já vem com o link da página, sem data, hora ou texto extra no final.
- Nenhuma configuração é necessária.

## Como usar

### 1. Copiando e colando

1. Abra a página no Web viewer.
2. Selecione o texto e pressione `Ctrl+C` (`Cmd+C` no Mac).
3. Abra a nota, coloque o cursor onde quiser a citação e pressione `Ctrl+V` (`Cmd+V` no Mac).

### 2. Pelo botão direito

1. Selecione o texto no Web viewer.
2. Clique com o botão direito.
3. Escolha **Inserir citação na nota**.

A citação é inserida no cursor da última nota em que você estava.

### 3. Pela paleta de comandos

Procure por:

> **Webview Text Selector: Inserir citação da seleção atual do Web viewer**

Esse comando lê a seleção que está no Web viewer e insere a citação na última nota. Ele pode receber um atalho de teclado, se você preferir.

## Como fica a citação

```markdown
> primeira linha do texto
> segunda linha do texto
>
> [Título da página](<https://exemplo.com/pagina>)
```

- Cada linha do texto selecionado recebe um `>`.
- O link da página fica no final, com o título entre colchetes.
- Não há data nem hora.
- Se o cursor estiver no meio de um parágrafo, o plugin ajusta as quebras de linha para a citação ficar organizada.

## Instalação

### Com o script

No terminal, dentro da pasta do plugin:

```bash
./install.sh /caminho/do/seu/vault
```

### Manualmente

1. Gere os arquivos com `npm install` e `npm run build`.
2. Copie `main.js` e `manifest.json` para:

   ```
   <SeuVault>/.obsidian/plugins/webview-text-selector/
   ```

3. No Obsidian, abra **Configurações → Plugins da comunidade** e ative o **Webview Text Selector**.

Se você já usava a versão 1.0, pode apagar o arquivo `styles.css` da pasta do plugin: ele não é mais necessário.

## Requisitos

- Obsidian para computador, versão **1.8.0** ou mais recente.
- O recurso **Web viewer** precisa estar habilitado no Obsidian.
- Não funciona no Obsidian para celular.

## Quando algo não funcionar

- **O item do botão direito não aparece:** use o atalho de copiar e colar ou o comando da paleta.
- **A colagem entrou como texto normal:** alguns sites mudam o texto ao copiar. Nesse caso, o plugin prefere não alterar o que você colou.
- **O texto estava dentro de uma área incorporada da página:** esse tipo de conteúdo pode não ser reconhecido.
- **Nenhuma nota está aberta:** abra uma nota em Markdown antes de usar o item do menu.

## Privacidade

O plugin trabalha apenas dentro do Obsidian. O texto copiado não é enviado para nenhum servidor e fica somente no seu computador.

## Como funciona, em resumo

O plugin percebe quando você copia um texto no Web viewer e guarda essa informação. Na hora de colar em uma nota, se o texto for o mesmo, ele monta a citação em vez de colar o texto solto. Fora das notas, a colagem continua funcionando normalmente.

## Estrutura do projeto

Para quem quiser entender ou contribuir com o código:

```
src/
├── citation/   # formatação, armazenamento e inserção das citações
├── webviewer/  # integração com o Web viewer do Obsidian
├── plugin/     # composição geral do plugin
├── shared/     # tipos e utilidades compartilhadas
└── main.ts     # ponto de entrada
```

O código está comentado para facilitar a leitura.
