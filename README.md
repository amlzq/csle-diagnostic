Language: English | [简体中文](./README_zh.md)

Diagnoses whether string literal expressions contain Chinese characters, and can quickly convert them between the usage of different Chinese regions.

### Features

- **Diagnose string literals**: finds string literals that contain Chinese characters and quick-fixes them between the usage of different Chinese regions (Simplified, Taiwan, Hong Kong, general Traditional). Documentation comments can optionally be checked too (`checkDocComment`).
- **Choose the glyphs**: in the settings, pick the glyph to diagnose (`checkGlyph`) and the glyph to convert to (`convertGlyph`).
- **Exclude names**: skip strings at certain locations, such as keys, tags, or function calls like `print`. `excludeNames` applies to all languages; `excludeNamesByLanguage` adds names for one language only (pick the language as the item, enter comma-separated names as the value).
- **Diagnose all files**: scan the whole workspace from the Command Palette (`Chinese Expression Diagnostic: Diagnostic All Files`) or right-click a folder in the Explorer and choose `Diagnostic This Folder`. Results are listed by file in the **Chinese Expression Diagnostic** view, where you can jump to an item, accept or dismiss it, accept a file, or `Accept All`. Files are not saved and changes can be undone. Enable `autoDiagnosticOnOpen` (off by default) to scan when a project opens; nothing is modified automatically. Related settings: `workspaceExclude`, `maxFileSize`, `previewBeforeApply`, `saveAfterApply`, `autoDiagnosticMaxFiles`.
- **Custom dictionary**: override the built-in conversion with your own word mappings. Dictionaries use the OpenCC format (`source<Tab>target`, one entry per line, `#` starts a comment) and are kept one file per Convert Glyph (`cn.txt`, `twp.txt`, `hk.txt`, `t.txt`). Set `customDictionaryDirectory` to a folder in your repository (`${workspaceFolder}` or a relative path) to share one dictionary with your team. Add entries from the right-click menu (**Add Custom Dictionary Entry…**) or the **Add to custom dictionary…** quick fix, and use **Manage Custom Dictionary…** to search, edit, delete, import, export, or clear entries for any glyph. Custom entries win over the built-in conversion, and mapping a word to itself keeps it unchanged.

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
