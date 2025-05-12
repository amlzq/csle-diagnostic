import * as assert from 'assert';
import * as vscode from 'vscode';

suite('CsleActivation 扩展测试', () => {
    test('应识别 Dart 字符串中的简体中文并提供修复', async () => {
        // 创建一个临时 Dart 文档，内容包含简体中文
        const doc = await vscode.workspace.openTextDocument({ language: 'dart', content: "var s = '简体测试';" });
        await vscode.window.showTextDocument(doc);
        // 等待插件进行诊断（实际环境中可能需要延时）
        await new Promise(resolve => setTimeout(resolve, 500));

        // 获取诊断信息，应该有一个警告
        const diagnostics = vscode.languages.getDiagnostics(doc.uri);
        assert.strictEqual(diagnostics.length, 1, '应检测到一个诊断');
        assert.ok(diagnostics[0].message.includes('简体'), '诊断信息应包含“简体”');

        // 获取快速修复选项
        const range = diagnostics[0].range;
        const actions = await vscode.commands.executeCommand<vscode.CodeAction[]>(
            'vscode.executeCodeActionProvider',
            doc.uri, range
        );
        assert.ok(actions && actions.length > 0, '应提供至少一个 Quick Fix');
        const fix = actions.find(a => a.title.includes('繁體'));
        assert.ok(fix, '应提供将简体转换为繁体的修复操作');

        // 应用修复并检查结果
        const workspaceEdit = fix.edit as vscode.WorkspaceEdit;
        await vscode.workspace.applyEdit(workspaceEdit);

        // 验证文档内容已被替换为繁体
        const newText = doc.getText();
        assert.strictEqual(newText, "var s = '繁體測試';", '字符串应被转换为繁体');
    });
});
