import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { scanScope } from '../scan/scanWorkspace';

suite('批量扫描测试', function () {
    this.timeout(60000);
    let dir: string;

    suiteSetup(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'csle-scan-'));
        fs.mkdirSync(path.join(dir, 'sub'));
        fs.mkdirSync(path.join(dir, 'node_modules'));
        fs.writeFileSync(path.join(dir, 'a.ts'), "const s = '简体测试';\n");
        fs.writeFileSync(path.join(dir, 'sub', 'b.py'), "s = '简体测试'\nt = 'hello'\n");
        fs.writeFileSync(path.join(dir, 'node_modules', 'c.js'), "var s = '简体测试';\n");
        fs.writeFileSync(path.join(dir, 'readme.txt'), '简体测试');
    });

    suiteTeardown(() => {
        fs.rmSync(dir, { recursive: true, force: true });
    });

    test('应扫描文件夹内受支持的文件并排除 node_modules', async () => {
        const summary = await scanScope([vscode.Uri.file(dir)]);
        const names = summary.files.map(f => path.relative(dir, f.uri.fsPath)).sort();
        assert.deepStrictEqual(names, ['a.ts', path.join('sub', 'b.py')]);
        assert.strictEqual(summary.scanned, 2);
        const a = summary.files.find(f => f.uri.fsPath.endsWith('a.ts'))!;
        assert.strictEqual(a.findings[0].original, "'简体测试'");
        assert.strictEqual(a.findings[0].fixed, "'簡體測試'");
    });

    test('仅扫描子目录时不包含范围外文件', async () => {
        const summary = await scanScope([vscode.Uri.file(path.join(dir, 'sub'))]);
        assert.strictEqual(summary.files.length, 1);
        assert.ok(summary.files[0].uri.fsPath.endsWith('b.py'));
    });

    test('maxFileSize 应跳过过大文件', async () => {
        const config = vscode.workspace.getConfiguration('cslediagnostic');
        await config.update('maxFileSize', 0.001, vscode.ConfigurationTarget.Global);
        try {
            const summary = await scanScope([vscode.Uri.file(dir)]);
            assert.strictEqual(summary.files.length, 0);
            assert.strictEqual(summary.skippedLarge, 2);
        } finally {
            await config.update('maxFileSize', undefined, vscode.ConfigurationTarget.Global);
        }
    });
});
