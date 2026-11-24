Language: English | [简体中文](./README.zh-CN.md)

Diagnoses whether string literal expressions contain Chinese characters, and can quickly convert them between the usage of different Chinese regions.

### Features

- **Automatic Chinese detection**: flags string literals that contain Chinese characters while you edit, and converts them to different regional usages (Simplified, Taiwan, Hong Kong, general Traditional) with a quick fix. Checking comments is optional.
- **Choose your regions**: pick which Chinese variant to check and which one to convert to.
- **Skip what you don't need**: exclude Chinese in keys, tags, or function-call arguments, either globally or for a specific language.
- **Scan a whole project**: run `Chinese Expression Diagnostic: Diagnostic All Files` from the Command Palette, or right-click a folder and choose `Diagnostic This Folder`. Results are grouped by file; you can jump to an item, accept or dismiss it, or accept everything at once. Nothing is saved automatically, changes can be undone, and scanning on project open is off by default.
- **Custom dictionary**: override the built-in conversion with your own word mappings, organized by region and shared with your team. Add entries from the right-click menu or a quick fix, and manage, import, or export them in one place.

### Supported languages

- CSS
- Dart
- HTML
- JavaScript and TypeScript
- JSON
- PHP
- Python

If you want more supported languages, open an [issue](https://github.com/amlzq/csle-diagnostic/issues).

### Select IDE

[VSCode extension](https://marketplace.visualstudio.com/items?itemName=amlzq.csle-diagnostic)

[IntelliJ plugin](https://plugins.jetbrains.com/plugin/26834-chinese-expression-inspection)

### Thanks

[opencc-js](https://github.com/nk2028/opencc-js)

### License

[Apache License 2.0](./LICENSE)
