import * as assert from 'assert';
import * as vscode from 'vscode';
import { scheduleAutoDiagnostic } from '../commands/autoDiagnostic';
import { runScan } from '../commands/diagnosticAll';
import { ResultsStore } from '../view/resultsTreeProvider';
import { delay, withConfig } from './utils';

const fakeFiles = (n: number) => Array.from({ length: n }, (_, i) => vscode.Uri.file(`/tmp/f${i}.ts`));

suite('自动诊断测试', function () {
    this.timeout(60000);
    let store: ResultsStore;
    let calls: Array<{ silent?: boolean; files?: vscode.Uri[] }>;
    let messages: string[];

    const fakeRun = (async (s: ResultsStore, _scope: vscode.Uri[], options: { silent?: boolean; files?: vscode.Uri[] } = {}) => {
        calls.push(options);
        const summary = { files: [], scanned: 1, skippedLarge: 0, failed: 0, cancelled: false };
        s.set([], summary);
        return { status: 'done' as const, summary };
    }) as unknown as typeof runScan;

    const deps = (extra: object = {}) => ({
        delayMs: 0,
        canRun: () => true,
        collect: async () => fakeFiles(3),
        run: fakeRun,
        showInfo: async (m: string) => { messages.push(m); return undefined; },
        ...extra,
    });

    setup(() => {
        store = new ResultsStore();
        calls = [];
        messages = [];
    });
    teardown(() => store.dispose());

    test('默认关闭时不应触发扫描', async () => {
        const handle = scheduleAutoDiagnostic(store, deps());
        await handle.idle();
        assert.strictEqual(calls.length, 0);
        handle.dispose();
    });

    test('开启后应以静默模式扫描一次并传入已收集的文件', async () => {
        await withConfig({ autoDiagnosticOnOpen: true }, async () => {
            const handle = scheduleAutoDiagnostic(store, deps());
            await handle.idle();
            assert.strictEqual(calls.length, 1);
            assert.strictEqual(calls[0].silent, true);
            assert.strictEqual(calls[0].files?.length, 3);
            handle.dispose();
        });
    });

    test('无工作区或不受信任时不应触发', async () => {
        await withConfig({ autoDiagnosticOnOpen: true }, async () => {
            const handle = scheduleAutoDiagnostic(store, deps({ canRun: () => false }));
            await handle.idle();
            assert.strictEqual(calls.length, 0);
            handle.dispose();
        });
    });

    test('文件数超过阈值时应跳过并提示，等于阈值时仍扫描', async () => {
        await withConfig({ autoDiagnosticOnOpen: true, autoDiagnosticMaxFiles: 2 }, async () => {
            const over = scheduleAutoDiagnostic(store, deps());
            await over.idle();
            assert.strictEqual(calls.length, 0);
            assert.strictEqual(messages.length, 1);
            over.dispose();
        });
        await withConfig({ autoDiagnosticOnOpen: true, autoDiagnosticMaxFiles: 3 }, async () => {
            const equal = scheduleAutoDiagnostic(store, deps());
            await equal.idle();
            assert.strictEqual(calls.length, 1);
            equal.dispose();
        });
    });

    test('已有结果时应跳过', async () => {
        const uri = vscode.Uri.file('/tmp/z.ts');
        const finding = { uri, range: new vscode.Range(0, 0, 0, 1), original: 'a', fixed: 'b' };
        store.set([], { files: [{ uri, findings: [finding] }], scanned: 1, skippedLarge: 0, failed: 0, cancelled: false });
        await withConfig({ autoDiagnosticOnOpen: true }, async () => {
            const handle = scheduleAutoDiagnostic(store, deps());
            await handle.idle();
            assert.strictEqual(calls.length, 0);
            handle.dispose();
        });
    });

    test('运行时开启设置应触发扫描，关闭则取消排队', async () => {
        const handle = scheduleAutoDiagnostic(store, deps({ delayMs: 300 }));
        await withConfig({ autoDiagnosticOnOpen: true }, async () => {
            await handle.idle();
            assert.strictEqual(calls.length, 1);
        });
        handle.dispose();

        const handle2 = scheduleAutoDiagnostic(new ResultsStore(), deps({ delayMs: 2000 }));
        const config = vscode.workspace.getConfiguration('cslediagnostic');
        try {
            await config.update('autoDiagnosticOnOpen', true, vscode.ConfigurationTarget.Global);
            await delay(200);
            await config.update('autoDiagnosticOnOpen', false, vscode.ConfigurationTarget.Global);
            await handle2.idle();
            assert.strictEqual(calls.length, 1, '关闭后排队的扫描不应执行');
        } finally {
            await config.update('autoDiagnosticOnOpen', undefined, vscode.ConfigurationTarget.Global);
            handle2.dispose();
        }
    });
});
