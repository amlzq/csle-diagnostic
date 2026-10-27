语言: 简体中文 | [English](./README.md)

诊断字符串字面量表达式是否包含中文汉字，并可以在简体字或繁体字之间快速转化。

如果您不想检查某些位置的字符串，例如：print 方法的字符串形参，则可以在设置中排除它们。

在插件设置视图中，您可以配置要检查的字形以及快速转化的字形。

### 诊断所有文件

- 命令面板：`Chinese Expression Diagnostic: Diagnostic All Files`（中文表达式诊断：诊断所有文件）扫描整个工作区。
- 资源管理器：右键一个或多个文件夹，选择「诊断此文件夹」。
- 结果显示在资源管理器的「中文表达式诊断」视图中，按文件分组并显示「原文 → 转换后」，点击条目可跳转。
- 可逐条接受 / 忽略、接受整个文件，或点击「全部接受」（会先确认）。修改**不会自动保存**，可以撤销；仍建议先提交代码。
- 相关设置：`workspaceExclude`、`maxFileSize`、`previewBeforeApply`（通过 VS Code 重构预览复查）、`saveAfterApply`。

### 支持语言

- Dart
- JavaScript and TypeScript
- HTML / CSS
- JSON
- PHP
- Python

如果你想更多支持的语言，可以创建 [issue](https://github.com/amlzq/CsleInspection/issues)。

### 安装

[IntelliJ 插件](https://plugins.jetbrains.com/plugin/26834-chinese-expression-inspection)

[VSCode 扩展](https://marketplace.visualstudio.com/items?itemName=amlzq.csle-diagnostic)

### 感谢

[opencc-js](https://github.com/nk2028/opencc-js)
