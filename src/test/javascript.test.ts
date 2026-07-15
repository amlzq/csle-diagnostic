import * as assert from 'assert';
import * as vscode from 'vscode';
import { waitForDiagnostics, waitForDiagnosticsCount, applyPreferredFixes } from './utils.js';

suite('JavaScript/JSX 诊断测试', function () {
    this.timeout(60000);

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

    test('应识别 JavaScript 模板字符串静态片段并提供修复', async () => {
        const doc = await vscode.workspace.openTextDocument({
            language: 'javascript',
            content: "const name = 'x';\nconst s = `网络 ${name} 结束`;\n",
        });
        await vscode.window.showTextDocument(doc);

        const diagnostics = await waitForDiagnosticsCount(doc.uri, 2);
        assert.strictEqual(diagnostics.length, 2, '应检测到两个诊断');
        await applyPreferredFixes(doc, diagnostics);
        assert.ok(doc.getText().includes('網路'));
    });

    test('Web 解析失败时不应产生诊断', async () => {
        const doc = await vscode.workspace.openTextDocument({
            language: 'javascript',
            content: 'export const = 1;\n',
        });
        await vscode.window.showTextDocument(doc);

        const diagnostics = await waitForDiagnosticsCount(doc.uri, 0);
        assert.strictEqual(diagnostics.length, 0);
    });
});
