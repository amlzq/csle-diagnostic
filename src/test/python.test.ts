import * as assert from 'assert';
import * as vscode from 'vscode';
import { waitForDiagnosticsCount, applyPreferredFix } from './utils.js';

suite('Python 诊断测试', function () {
    this.timeout(60000);

    test('应识别 Python 字符串内容范围并提供修复', async () => {
        const doc = await vscode.workspace.openTextDocument({
            language: 'python',
            content: 's = "简体测试"\n',
        });
        await vscode.window.showTextDocument(doc);

        const diagnostics = await waitForDiagnosticsCount(doc.uri, 1);
        assert.strictEqual(diagnostics.length, 1, '应检测到一个诊断');
        assert.strictEqual(doc.getText(diagnostics[0].range), '简体测试');

        await applyPreferredFix(doc, diagnostics[0]);
        assert.strictEqual(doc.getText(), 's = "簡體測試"\n');
    });
});
