Language: English | [简体中文](./README_zh.md)

csle, short for "Chinese String Literal Expression", diagnoses whether the string literal expression contains Chinese characters, and can quickly fix them between simplified or traditional glyphs.

In the extension settings view, you can exclude strings in certain locations, such as print, if you don't want to diagnose them.

In the extension settings view, you can modify the Chinese characters glyphs you want to diagnose and the glyphs to quickly fix.

### Diagnose all files

- Command Palette: `Chinese Expression Diagnostic: Diagnostic All Files` scans the whole workspace.
- Explorer: right-click one or more folders and choose `Diagnostic This Folder`.
- Results appear in the **Chinese Expression Diagnostic** view in the Explorer, grouped by file with `original → converted`. Click an item to jump to it.
- Use the buttons to accept or dismiss a single item, accept a whole file, or `Accept All` (after a confirmation). Changes are **not saved** automatically and can be undone; commit your work first anyway.
- Automatic diagnosis: turn on `autoDiagnosticOnOpen` (off by default) to scan the whole workspace a few seconds after a project opens. Results are listed in the view and a non-intrusive notification offers `View Results`; nothing is ever modified automatically. It is skipped in untrusted workspaces and when the workspace has more than `autoDiagnosticMaxFiles` files (default 5000); run the command manually in that case.
- Related settings: `workspaceExclude`, `maxFileSize`, `previewBeforeApply` (review in VS Code's Refactor Preview), `saveAfterApply`, `autoDiagnosticOnOpen`, `autoDiagnosticMaxFiles`.

### Supported languages

- Dart
- JavaScript and TypeScript
- HTML / CSS
- JSON
- PHP
- Python

If you want more supported languages, new an [issue](https://github.com/amlzq/CsleInspection/issues).

### Installation

[VSCode extension](https://marketplace.visualstudio.com/items?itemName=amlzq.csle-diagnostic)

[IntelliJ plugin](https://plugins.jetbrains.com/plugin/26834-chinese-expression-inspection)

### Thanks

[opencc-js](https://github.com/nk2028/opencc-js)
