import * as assert from 'assert';
import * as vscode from 'vscode';
import { waitForDiagnosticsCount, applyPreferredFixes } from './utils.js';

suite('JSON 诊断测试', function () {
    this.timeout(60000);

    test('应识别 JSON 字符串值并提供修复', async () => {
        const doc = await vscode.workspace.openTextDocument({
            language: 'json',
            content: '{\n  "title": "简体测试",\n  "nested": { "k": "网络" }\n}\n',
        });
        await vscode.window.showTextDocument(doc);

        const diagnostics = await waitForDiagnosticsCount(doc.uri, 2);
        assert.strictEqual(diagnostics.length, 2, '应检测到两个诊断');

        await applyPreferredFixes(doc, diagnostics);
        const newText = doc.getText();
        assert.ok(newText.includes('"簡體測試"'));
        assert.ok(newText.includes('"網路"'));
    });
});
