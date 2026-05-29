import * as assert from 'assert';
import * as vscode from 'vscode';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function getCsleDiagnostics(uri: vscode.Uri): vscode.Diagnostic[] {
    return vscode.languages
        .getDiagnostics(uri)
        .filter(d => d.code === 'csle-convert');
}

async function waitForDiagnostics(
    uri: vscode.Uri,
    timeoutMs = 8000
): Promise<vscode.Diagnostic[]> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        const diagnostics = getCsleDiagnostics(uri);
        if (diagnostics.length > 0) return diagnostics;
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    return getCsleDiagnostics(uri);
}

async function waitForDiagnosticsCount(
    uri: vscode.Uri,
    expectedCount: number,
    timeoutMs = 8000
): Promise<vscode.Diagnostic[]> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        const diagnostics = getCsleDiagnostics(uri);
        if (diagnostics.length === expectedCount) {
            if (expectedCount === 0) {
                await delay(300);
                const after = getCsleDiagnostics(uri);
                if (after.length === 0) return after;
            } else {
                return diagnostics;
            }
        }
        await delay(100);
    }
    return getCsleDiagnostics(uri);
}

async function applyPreferredFix(doc: vscode.TextDocument, diagnostic: vscode.Diagnostic) {
    const actions = await vscode.commands.executeCommand<vscode.CodeAction[]>(
        'vscode.executeCodeActionProvider',
        doc.uri,
        diagnostic.range
    );
    assert.ok(actions && actions.length > 0, '应提供至少一个 Quick Fix');
    const fix = actions.find(a => (a.diagnostics ?? []).some(d => d.code === 'csle-convert')) ?? actions[0];
    assert.ok(!!fix.edit, '修复操作应包含 edit');
    await vscode.workspace.applyEdit(fix.edit as vscode.WorkspaceEdit);
}

async function applyPreferredFixes(doc: vscode.TextDocument, diagnostics: vscode.Diagnostic[]) {
    const sorted = [...diagnostics].sort((a, b) => doc.offsetAt(b.range.start) - doc.offsetAt(a.range.start));
    for (const d of sorted) {
        await applyPreferredFix(doc, d);
    }
}

async function withConfig<T>(
    updates: Record<string, unknown>,
    fn: () => Promise<T>
): Promise<T> {
    const config = vscode.workspace.getConfiguration('cslediagnostic');
    const previous = new Map<string, unknown>();
    for (const key of Object.keys(updates)) {
        previous.set(key, config.get(key));
        await config.update(key, updates[key], vscode.ConfigurationTarget.Global);
    }
    await delay(200);
    try {
        return await fn();
    } finally {
        for (const [key, value] of previous.entries()) {
            await config.update(key, value as any, vscode.ConfigurationTarget.Global);
        }
        await delay(200);
    }
}

suite('CsleActivation 扩展测试', function () {
    this.timeout(60000);
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
        await withConfig(
            {
                checkGlyph: vscode.l10n.t('Traditional Chinese'),
                convertGlyph: vscode.l10n.t('Simplified Chinese'),
            },
            async () => {
                const doc = await vscode.workspace.openTextDocument({
                    language: 'typescript',
                    content: "const s = '簡體測試';\n",
                });
                await vscode.window.showTextDocument(doc);

                const diagnostics = await waitForDiagnosticsCount(doc.uri, 1);
                assert.strictEqual(diagnostics.length, 1, '应检测到一个诊断');
                await applyPreferredFix(doc, diagnostics[0]);
                assert.strictEqual(doc.getText(), "const s = '简体测试';\n");
            }
        );
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

    test('默认配置下繁体文本不应产生诊断', async () => {
        await withConfig(
            {
                checkGlyph: vscode.l10n.t('Simplified Chinese'),
                convertGlyph: vscode.l10n.t('Chinese (Taiwan)'),
                excludeNames: [],
            },
            async () => {
                const doc = await vscode.workspace.openTextDocument({
                    language: 'typescript',
                    content: "const s = '網路';\n",
                });
                await vscode.window.showTextDocument(doc);

                const diagnostics = await waitForDiagnosticsCount(doc.uri, 0);
                assert.strictEqual(diagnostics.length, 0, '繁体文本在默认检查简体配置下不应报警');
            }
        );
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

    test('应识别 Dart 三引号字符串并提供修复', async () => {
        const doc = await vscode.workspace.openTextDocument({
            language: 'dart',
            content: 'var s = """简体测试""";\n',
        });
        await vscode.window.showTextDocument(doc);

        const diagnostics = await waitForDiagnosticsCount(doc.uri, 1);
        assert.strictEqual(diagnostics.length, 1, '应检测到一个诊断');
        await applyPreferredFix(doc, diagnostics[0]);
        assert.ok(doc.getText().includes('"""簡體測試"""'));
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
