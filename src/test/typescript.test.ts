import * as assert from 'assert';
import * as vscode from 'vscode';
import { waitForDiagnosticsCount, applyPreferredFix, applyPreferredFixes } from './utils.js';

suite('TypeScript/TSX 诊断测试', function () {
    this.timeout(60000);

    test('应识别 TypeScript 多处字符串并可批量修复', async () => {
        const doc = await vscode.workspace.openTextDocument({
            language: 'typescript',
            content: "const a = '简体测试';\nconst b = \"简体测试\";\n",
        });
        await vscode.window.showTextDocument(doc);

        const diagnostics = await waitForDiagnosticsCount(doc.uri, 2);
        assert.strictEqual(diagnostics.length, 2, '应检测到两个诊断');
        assert.ok(diagnostics.every(d => d.code === 'csle-convert'));

        await applyPreferredFixes(doc, diagnostics);
        const newText = doc.getText();
        assert.ok(newText.includes('簡體測試'));
        assert.ok(!newText.includes('简体测试'));
    });

    test('应识别 TSX JSXAttribute 字符串并提供修复', async () => {
        const doc = await vscode.workspace.openTextDocument({
            language: 'typescriptreact',
            content: 'export const App = () => <div title="简体测试"></div>;\n',
        });
        await vscode.window.showTextDocument(doc);

        const diagnostics = await waitForDiagnosticsCount(doc.uri, 1);
        assert.strictEqual(diagnostics.length, 1, '应检测到一个诊断');
        assert.strictEqual(diagnostics[0].code, 'csle-convert', '诊断 code 应为 csle-convert');
        assert.ok(doc.getText(diagnostics[0].range).includes('简体测试'));

        await applyPreferredFix(doc, diagnostics[0]);
        assert.ok(doc.getText().includes('title="簡體測試"'));
    });
});
