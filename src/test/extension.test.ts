import * as assert from 'assert';
import * as vscode from 'vscode';

async function waitForDiagnostics(
    uri: vscode.Uri,
    timeoutMs = 8000
): Promise<vscode.Diagnostic[]> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        const diagnostics = vscode.languages.getDiagnostics(uri);
        if (diagnostics.length > 0) return diagnostics;
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    return vscode.languages.getDiagnostics(uri);
}

suite('CsleActivation 扩展测试', function () {
    this.timeout(20000);
    test('应识别 Dart 字符串中的简体中文并提供修复', async () => {
        // 创建一个临时 Dart 文档，内容包含简体中文
        const doc = await vscode.workspace.openTextDocument({ language: 'dart', content: "var s = '简体测试';" });
        await vscode.window.showTextDocument(doc);

        // 获取诊断信息，应该有一个警告
        const diagnostics = await waitForDiagnostics(doc.uri);
        assert.strictEqual(diagnostics.length, 1, '应检测到一个诊断');
        assert.strictEqual(diagnostics[0].code, 'csle-convert', '诊断 code 应为 csle-convert');

        // 获取快速修复选项
        const range = diagnostics[0].range;
        const actions = await vscode.commands.executeCommand<vscode.CodeAction[]>(
            'vscode.executeCodeActionProvider',
            doc.uri, range
        );
        assert.ok(actions && actions.length > 0, '应提供至少一个 Quick Fix');
        const fix = actions.find(a => (a.diagnostics ?? []).some(d => d.code === 'csle-convert')) ?? actions[0];
        assert.ok(!!fix.edit, '修复操作应包含 edit');

        // 应用修复并检查结果
        const workspaceEdit = fix.edit as vscode.WorkspaceEdit;
        await vscode.workspace.applyEdit(workspaceEdit);

        // 验证文档内容已被替换为繁体
        const newText = doc.getText();
        assert.strictEqual(newText, "var s = '簡體測試';", '字符串应被转换为繁体');
    });

    test('应识别 JSX 模板字符串中的简体中文并提供修复', async () => {
        const doc = await vscode.workspace.openTextDocument({
            language: 'javascriptreact',
            content: "const greeting = 'hi';\nexport const App = () => <div>{`网3络 ${greeting}`}</div>;\n",
        });
        await vscode.window.showTextDocument(doc);

        const diagnostics = await waitForDiagnostics(doc.uri);
        assert.strictEqual(diagnostics.length, 1, '应检测到一个诊断');
        assert.strictEqual(diagnostics[0].code, 'csle-convert', '诊断 code 应为 csle-convert');

        const range = diagnostics[0].range;
        assert.strictEqual(doc.getText(range), '网3络 ', '诊断范围应定位到模板字符串静态片段');
    });
});
