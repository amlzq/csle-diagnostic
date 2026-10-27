import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { runScan } from '../commands/diagnosticAll';
import { ResultsStore } from '../view/resultsTreeProvider';

suite('runScan 互斥与静默模式测试', function () {
    this.timeout(60000);
    let dir: string;
    let store: ResultsStore;

    setup(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'csle-run-'));
        for (const name of ['a', 'b', 'c', 'd']) {
            fs.writeFileSync(path.join(dir, `${name}.ts`), "const s = '简体测试';\n");
        }
        store = new ResultsStore();
    });

    teardown(() => {
        store.dispose();
        fs.rmSync(dir, { recursive: true, force: true });
    });

    test('静默扫描应写入结果并返回 done', async () => {
        const outcome = await runScan(store, [vscode.Uri.file(dir)], { silent: true });
        assert.strictEqual(outcome.status, 'done');
        assert.strictEqual(store.files.length, 4);
    });

    test('已有扫描运行时，静默扫描应被跳过', async () => {
        const scope = [vscode.Uri.file(dir)];
        const first = runScan(store, scope, { silent: true });
        const second = await runScan(store, scope, { silent: true });
        assert.strictEqual(second.status, 'skipped');
        assert.strictEqual((await first).status, 'done');
    });

    test('手动扫描应取消正在运行的静默扫描', async () => {
        const scope = [vscode.Uri.file(dir)];
        const auto = runScan(store, scope, { silent: true });
        const manual = await runScan(store, scope);
        assert.strictEqual(manual.status, 'done');
        assert.strictEqual((await auto).status, 'cancelled');
        assert.strictEqual(store.files.length, 4);
    });

    test('传入 files 时不应再查找文件', async () => {
        const only = vscode.Uri.file(path.join(dir, 'a.ts'));
        const outcome = await runScan(store, [vscode.Uri.file(dir)], { silent: true, files: [only] });
        assert.strictEqual(outcome.status, 'done');
        assert.strictEqual(store.files.length, 1);
    });
});
