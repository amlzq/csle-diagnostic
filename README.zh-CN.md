语言: 简体中文 | [English](./README.md)

诊断字符串字面量表达式是否包含中文汉字，并可以在中文各地区的习惯用语（大陆、台湾、香港）之间快速转换。

### 功能

- **自动检查中文字符串**：编辑时标出包含中文的字符串，可一键转换成不同地区习惯用语（简体、台湾、香港、通用繁体）；也可以选择检查注释中的中文。
- **选择地区用语**：在设置中选择要检查的地区和目标地区，转换结果会按你的选择生成。
- **忽略不需要检查的内容**：可以跳过键名、标签、函数调用参数等位置的中文，支持全局设置，也支持按语言单独设置。
- **批量检查项目**：在命令面板运行 `Chinese Expression Diagnostic: Diagnostic All Files`，或右键文件夹选择 `Diagnostic This Folder`。结果按文件列出，可逐条跳转、接受或忽略，也可一键接受全部；默认不会自动保存，修改可撤销，打开项目时自动扫描默认关闭。
- **自定义词典**：用自己的词条覆盖内置转换，按地区维护并在团队内共享；可从右键菜单或快速修复添加词条，也能集中管理、导入和导出。

### 支持语言

- CSS
- Dart
- HTML
- JavaScript and TypeScript
- JSON
- PHP
- Python

如果你想更多支持的语言，可以创建 [issue](https://github.com/amlzq/CsleInspection/issues)。

### 安装

[IntelliJ 插件](https://plugins.jetbrains.com/plugin/26834-chinese-expression-inspection)

[VSCode 扩展](https://marketplace.visualstudio.com/items?itemName=amlzq.csle-diagnostic)

### 感谢

[opencc-js](https://github.com/nk2028/opencc-js)

### 许可证

[Apache License 2.0](./LICENSE)
