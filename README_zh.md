语言: 简体中文 | [English](./README.md)

诊断字符串字面量表达式是否包含中文汉字，并可以在中文各地区的习惯用语（大陆、台湾、香港）之间快速转换。

### 功能

- **诊断字符串字面量**：找出包含中文汉字的字符串字面量，并可在中文各地区的习惯用语（简体、台湾、香港、通用繁体）之间快速转换。文档注释可选检查（`checkDocComment`）。
- **选择字形**：在设置中配置要检查的字形（`checkGlyph`）和要转换成的字形（`convertGlyph`）。
- **排除名称**：不想检查某些位置的字符串（如键名、标签、`print` 等函数调用的参数）时，可将它们排除。`excludeNames` 对所有语言生效；`excludeNamesByLanguage` 为单个语言追加排除项（Item 选择语言，Value 填写以英文逗号分隔的名称）。
- **诊断所有文件**：在命令面板运行 `Chinese Expression Diagnostic: Diagnostic All Files`（诊断所有文件）扫描工作区，或在资源管理器中右键文件夹，选择「诊断此文件夹」。结果按文件显示在「中文表达式诊断」视图中，可跳转到条目、接受或忽略单条、接受整个文件，或「全部接受」。文件不会自动保存，修改可撤销。开启 `autoDiagnosticOnOpen`（默认关闭）后，打开项目时自动扫描，不会自动修改文件。相关设置：`workspaceExclude`、`maxFileSize`、`previewBeforeApply`、`saveAfterApply`、`autoDiagnosticMaxFiles`。
- **自定义词典**：用自己的词条覆盖内置转换。词典使用 OpenCC 格式（每行 `原词<Tab>目标词`，`#` 开头为注释），按转换字形分文件存放（`cn.txt`、`twp.txt`、`hk.txt`、`t.txt`）。将 `customDictionaryDirectory` 指向仓库内的文件夹（支持 `${workspaceFolder}` 或相对路径），团队即可共用同一份词典。可通过右键菜单「Add Custom Dictionary Entry…」或快速修复「Add to custom dictionary…」添加词条，并用「Manage Custom Dictionary…」搜索、编辑、删除、导入、导出或清空任意字形的词典。自定义词条优先于内置转换；把词映射到自身可固定该词、不做转换。

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

### 许可证

[Apache License 2.0](./LICENSE)
