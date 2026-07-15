import * as assert from 'assert';
import * as vscode from 'vscode';
import { waitForDiagnosticsCount, applyPreferredFix } from './utils.js';

suite('PHP 诊断测试', function () {
    this.timeout(60000);

    test('应识别 PHP 单引号字符串并提供修复', async () => {
        const doc = await vscode.workspace.openTextDocument({
            language: 'php',
            content: "<?php\n$a = '简体测试';\n",
        });
        await vscode.window.showTextDocument(doc);

        const diagnostics = await waitForDiagnosticsCount(doc.uri, 1);
        assert.strictEqual(diagnostics.length, 1, '应检测到一个诊断');
        assert.ok(doc.getText(diagnostics[0].range).includes('简体测试'));

        await applyPreferredFix(doc, diagnostics[0]);
        assert.ok(doc.getText().includes("'簡體測試'"));
    });

    test('应识别 PHP Heredoc 并提供修复', async () => {
        const doc = await vscode.workspace.openTextDocument({
            language: 'php',
            content: "<?php\n$a = <<<EOT\n简体测试\nEOT;\n",
        });
        await vscode.window.showTextDocument(doc);

        const diagnostics = await waitForDiagnosticsCount(doc.uri, 1);
        assert.strictEqual(diagnostics.length, 1, '应检测到一个诊断');
        assert.ok(doc.getText(diagnostics[0].range).includes('<<<EOT'));

        await applyPreferredFix(doc, diagnostics[0]);
        assert.ok(doc.getText().includes('\n簡體測試\n'));
        assert.ok(doc.getText().includes('\nEOT;\n'));
    });

    test('应识别 PHP Nowdoc 并提供修复', async () => {
        const doc = await vscode.workspace.openTextDocument({
            language: 'php',
            content: "<?php\n$a = <<<'EOT'\n简体测试\nEOT;\n",
        });
        await vscode.window.showTextDocument(doc);

        const diagnostics = await waitForDiagnosticsCount(doc.uri, 1);
        assert.strictEqual(diagnostics.length, 1, '应检测到一个诊断');
        await applyPreferredFix(doc, diagnostics[0]);
        assert.ok(doc.getText().includes('\n簡體測試\n'));
    });
});
