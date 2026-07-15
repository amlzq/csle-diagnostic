import * as assert from 'assert';
import * as vscode from 'vscode';
import { waitForDiagnosticsCount, applyPreferredFix, withConfig } from './utils.js';

suite('配置诊断测试', function () {
    this.timeout(60000);

    test('excludeNames 配置应生效', async () => {
        await withConfig({ excludeNames: ['t'] }, async () => {
            const doc = await vscode.workspace.openTextDocument({
                language: 'typescript',
                content: "t('简体测试');\n",
            });
            await vscode.window.showTextDocument(doc);
            const diagnostics = await waitForDiagnosticsCount(doc.uri, 0);
            assert.strictEqual(diagnostics.length, 0, 'excludeNames 命中时不应产生诊断');
        });
    });

    test('反向配置应能识别繁体并转换为简体', async () => {
        await withConfig({
            checkGlyph: vscode.l10n.t('Traditional Chinese'),
            convertGlyph: vscode.l10n.t('Simplified Chinese'),
        }, async () => {
            const doc = await vscode.workspace.openTextDocument({
                language: 'typescript',
                content: "const s = '簡體測試';\n",
            });
            await vscode.window.showTextDocument(doc);
            const diagnostics = await waitForDiagnosticsCount(doc.uri, 1);
            assert.strictEqual(diagnostics.length, 1, '应检测到一个诊断');
            await applyPreferredFix(doc, diagnostics[0]);
            assert.strictEqual(doc.getText(), "const s = '简体测试';\n");
        });
    });

    test('默认配置下繁体文本不应产生诊断', async () => {
        await withConfig({
            checkGlyph: vscode.l10n.t('Simplified Chinese'),
            convertGlyph: vscode.l10n.t('Chinese (Taiwan)'),
            excludeNames: [],
        }, async () => {
            const doc = await vscode.workspace.openTextDocument({
                language: 'typescript',
                content: "const s = '網路';\n",
            });
            await vscode.window.showTextDocument(doc);
            const diagnostics = await waitForDiagnosticsCount(doc.uri, 0);
            assert.strictEqual(diagnostics.length, 0, '繁体文本在默认检查简体配置下不应报警');
        });
    });

    test('excludeNames 应支持点号方法名', async () => {
        await withConfig({ excludeNames: ['i18n.t'] }, async () => {
            const doc = await vscode.workspace.openTextDocument({
                language: 'typescript',
                content: "i18n.t('简体测试');\n",
            });
            await vscode.window.showTextDocument(doc);
            const diagnostics = await waitForDiagnosticsCount(doc.uri, 0);
            assert.strictEqual(diagnostics.length, 0);
        });
    });

    test('excludeNames 应支持按 JSON key 排除 value', async () => {
        await withConfig({ excludeNames: ['title'] }, async () => {
            const doc = await vscode.workspace.openTextDocument({
                language: 'json',
                content: '{ "title": "简体测试" }\n',
            });
            await vscode.window.showTextDocument(doc);
            const diagnostics = await waitForDiagnosticsCount(doc.uri, 0);
            assert.strictEqual(diagnostics.length, 0);
        });
    });

    test('excludeNames 应支持按 HTML tag 排除文本', async () => {
        await withConfig({ excludeNames: ['div'] }, async () => {
            const doc = await vscode.workspace.openTextDocument({
                language: 'html',
                content: '<div>简体测试</div>\n',
            });
            await vscode.window.showTextDocument(doc);
            const diagnostics = await waitForDiagnosticsCount(doc.uri, 0);
            assert.strictEqual(diagnostics.length, 0);
        });
    });

    test('配置变更后应触发已打开文档的重新诊断', async () => {
        const config = vscode.workspace.getConfiguration('cslediagnostic');
        const prevExclude = config.get('excludeNames');
        await config.update('excludeNames', [], vscode.ConfigurationTarget.Global);
        const doc = await vscode.workspace.openTextDocument({
            language: 'typescript',
            content: "t('简体测试');\n",
        });
        await vscode.window.showTextDocument(doc);
        const before = await waitForDiagnosticsCount(doc.uri, 1, 15000);
        assert.strictEqual(before.length, 1);
        try {
            await config.update('excludeNames', ['t'], vscode.ConfigurationTarget.Global);
            const after = await waitForDiagnosticsCount(doc.uri, 0, 20000);
            assert.strictEqual(after.length, 0);
        } finally {
            await config.update('excludeNames', prevExclude as any, vscode.ConfigurationTarget.Global);
        }
    });
});
