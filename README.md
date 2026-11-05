# WebRef

Turn text you read in Obsidian's **Web viewer** into ready-made citations in your notes.

The plugin does not open another browser: it uses the Web viewer that is already part of Obsidian.

## What you get

- Copied some text in the Web viewer? When you paste it into a note, it becomes a formatted citation.
- You can also cite through the right-click menu, without copying and pasting.
- The citation already includes the page link, with no date, time, or extra text at the end.
- It also works in the Web viewer's reader mode.
- No configuration is required.

## How to use

### 1. Copying and pasting

1. Open the page in the Web viewer.
2. Select the text and press `Ctrl+C` (`Cmd+C` on Mac).
3. Open the note, place the cursor where you want the citation, and press `Ctrl+V` (`Cmd+V` on Mac).

### 2. Through the right-click menu

1. Select the text in the Web viewer.
2. Right-click.
3. Choose **Inserir citação na nota**.

The citation is inserted at the cursor of the last note you were in.

### 3. Through the command palette

Search for:

> **WebRef: Inserir citação da seleção atual do Web viewer**

This command reads the current selection in the Web viewer and inserts the citation into the last note. You can assign a keyboard shortcut to it if you prefer.

## What the citation looks like

```markdown
> first line of the text
> second line of the text
>
> [Page title](<https://example.com/page>)
```

- Every line of the selected text gets a `>`.
- The page link goes at the end, with the title in square brackets.
- There is no date or time.
- If the cursor is in the middle of a paragraph, the plugin adjusts the line breaks so the citation stays organized.

## Installation

### With the script

In the terminal, inside the plugin folder:

```bash
./install.sh /path/to/your/vault
```

### Manually

1. Generate the files with `npm install` and `npm run build`.
2. Copy `main.js` and `manifest.json` to:

   ```
   <YourVault>/.obsidian/plugins/webref/
   ```

3. In Obsidian, open **Settings → Community plugins** and enable **WebRef**.

If you were already using version 1.0, you can delete the `styles.css` file from the plugin folder: it is no longer needed.

## Requirements

- Obsidian for desktop, version **1.8.0** or newer.
- The **Web viewer** feature must be enabled in Obsidian.
- It does not work on Obsidian for mobile.

## When something does not work

- **The right-click item does not appear:** use the copy-and-paste shortcut or the command palette.
- **The paste came in as plain text:** some sites change the text when copying. In that case, the plugin prefers not to change what you pasted.
- **The text was inside an embedded area of the page:** this kind of content may not be recognized.
- **No note is open:** open a Markdown note before using the menu item.

## Privacy

The plugin works only inside Obsidian. The copied text is not sent to any server and stays only on your computer.

## How it works, in short

The plugin notices when you copy text in the Web viewer and remembers it. When you paste into a note, if the text is the same, it builds the citation instead of pasting plain text. Outside notes, pasting continues to work normally.

## Project structure

For anyone who wants to understand or contribute to the code:

```
src/
├── citation/   # citation formatting, storage, and insertion
├── webviewer/  # integration with Obsidian's Web viewer
├── plugin/     # overall plugin composition
├── shared/     # shared types and utilities
└── main.ts     # entry point
```

The code is commented to make it easier to read.
