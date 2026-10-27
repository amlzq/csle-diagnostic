Language: English | [简体中文](./README_zh.md)

csle, short for "Chinese String Literal Expression", diagnoses whether the string literal expression contains Chinese characters, and can quickly fix them between simplified or traditional glyphs.

In the extension settings view, you can exclude strings in certain locations, such as print, if you don't want to diagnose them.

In the extension settings view, you can modify the Chinese characters glyphs you want to diagnose and the glyphs to quickly fix.

### Diagnose all files

- Command Palette: run `Chinese Expression Diagnostic: Diagnostic All Files` to scan the workspace.
- Explorer: right-click folders and choose `Diagnostic This Folder`.
- Results are listed by file in the **Chinese Expression Diagnostic** view; click an item to jump to it.
- Accept or dismiss one item, accept a file, or `Accept All`. Files are not saved and changes can be undone.
- Automatic diagnosis: enable `autoDiagnosticOnOpen` (off by default) to scan when a project opens. Nothing is modified automatically.
- Related settings: `workspaceExclude`, `maxFileSize`, `previewBeforeApply`, `saveAfterApply`, `autoDiagnosticOnOpen`, `autoDiagnosticMaxFiles`.

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
