import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { applyFindings, shiftFinding } from '../scan/applyFindings';
import { Finding } from '../scan/scanDocument';
import { scanScope } from '../scan/scanWorkspace';
import { ResultsStore } from '../view/resultsTreeProvider';

suite('应用修改测试', function () {
    this.timeout(60000);
    let dir: string;

    setup(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'csle-apply-'));
        fs.writeFileSync(path.join(dir, 'a.ts'), "const a = '简体测试';\nconst b = '软件';\n");
        fs.writeFileSync(path.join(dir, 'b.py'), "s = '简体测试'\n");
    });

    teardown(async () => {
        await vscode.commands.executeCommand('workbench.action.closeAllEditors');
        fs.rmSync(dir, { recursive: true, force: true });
    });

    test('应一次性应用全部条目且不保存文件', async () => {
        const summary = await scanScope([vscode.Uri.file(dir)]);
        const findings = summary.files.flatMap(f => f.findings);
        assert.strictEqual(findings.length, 3);

        const result = await applyFindings(findings);
        assert.strictEqual(result.applied.length, 3);
        assert.strictEqual(result.stale.length, 0);

        const a = await vscode.workspace.openTextDocument(vscode.Uri.file(path.join(dir, 'a.ts')));
        assert.strictEqual(a.getText(), "const a = '簡體測試';\nconst b = '軟體';\n");
        assert.ok(a.isDirty, '文件不应被自动保存');
        assert.strictEqual(fs.readFileSync(path.join(dir, 'a.ts'), 'utf8'), "const a = '简体测试';\nconst b = '软件';\n");
    });

    test('save 选项应在应用后保存文件', async () => {
        const summary = await scanScope([vscode.Uri.file(dir)]);
        const result = await applyFindings(summary.files.flatMap(f => f.findings), { save: true });
        assert.strictEqual(result.applied.length, 3);
        assert.strictEqual(fs.readFileSync(path.join(dir, 'b.py'), 'utf8'), "s = '簡體測試'\n");
    });

    test('扫描后被修改的条目应被跳过', async () => {
        const summary = await scanScope([vscode.Uri.file(dir)]);
        const findings = summary.files.flatMap(f => f.findings);

        const a = await vscode.workspace.openTextDocument(vscode.Uri.file(path.join(dir, 'a.ts')));
        const edit = new vscode.WorkspaceEdit();
        edit.replace(a.uri, new vscode.Range(0, 11, 0, 15), '其他内容');
        await vscode.workspace.applyEdit(edit);

        const result = await applyFindings(findings);
        assert.strictEqual(result.stale.length, 1);
        assert.strictEqual(result.applied.length, 2);
        assert.strictEqual(a.getText().split('\n')[0], "const a = '其他内容';");
    });

    test('同一行内后续条目的列号应随长度变化修正', () => {
        const uri = vscode.Uri.file('/tmp/x.ts');
        const mk = (sc: number, ec: number, original: string, fixed: string): Finding =>
            ({ uri, range: new vscode.Range(0, sc, 0, ec), original, fixed });
        const first = mk(0, 4, '"内存"', '"記憶體"');
        const second = mk(6, 10, '"软件"', '"軟體"');
        const shifted = shiftFinding(second, [first]);
        assert.strictEqual(shifted.range.start.character, 7);
        assert.strictEqual(shifted.range.end.character, 11);
        assert.strictEqual(shiftFinding(first, [second]), first);
    });

    test('ResultsStore.resolve 应移除已处理条目并清理空文件', () => {
        const uri = vscode.Uri.file('/tmp/y.ts');
        const f1: Finding = { uri, range: new vscode.Range(0, 0, 0, 4), original: 'a', fixed: 'b' };
        const f2: Finding = { uri, range: new vscode.Range(1, 0, 1, 4), original: 'a', fixed: 'b' };
        const store = new ResultsStore();
        store.set([], { files: [{ uri, findings: [f1, f2] }], scanned: 1, skippedLarge: 0, failed: 0, cancelled: false });
        store.resolve([f1]);
        assert.strictEqual(store.total, 1);
        store.resolve([f2]);
        assert.strictEqual(store.files.length, 0);
        store.dispose();
    });
});
