import * as vscode from 'vscode';
import { getUserConfig } from '../utils/config';
import { toLocale } from '../utils/utils';
import { Finding } from '../scan/scanDocument';
import { ScanSummary, scanScope } from '../scan/scanWorkspace';
import { registerAcceptCommands } from './acceptCommands';
import { RESULTS_VIEW_ID, ResultNode, ResultsStore, ResultsTreeProvider } from '../view/resultsTreeProvider';

export type ScanOutcome =
    | { status: 'skipped' }
    | { status: 'same-glyph' }
    | { status: 'cancelled' }
    | { status: 'done'; summary: ScanSummary };

export interface RunScanOptions {
    /** 静默模式（自动诊断）：状态栏进度、不弹提示、不聚焦视图，结果由调用方处理 */
    silent?: boolean;
    /** 已收集好的文件列表，避免重复查找 */
    files?: vscode.Uri[];
}

/** 当前正在运行的扫描；同一时间只允许一个，避免互相覆盖 ResultsStore */
let current: { cts: vscode.CancellationTokenSource; silent: boolean } | undefined;

/** 取消正在运行的静默（自动）扫描，例如用户关闭了自动诊断开关 */
export function cancelSilentScan() {
    if (current?.silent) {
        current.cts.cancel();
    }
}

export async function runScan(store: ResultsStore, scope: vscode.Uri[], options: RunScanOptions = {}): Promise<ScanOutcome> {
    const silent = options.silent === true;

    if (current) {
        // 自动扫描让位于任何正在运行的扫描；手动扫描只会取消自动扫描
        if (silent || !current.silent) {return { status: 'skipped' };}
        current.cts.cancel();
    }

    const { checkGlyph, convertGlyph } = getUserConfig(scope[0]);
    if (toLocale(checkGlyph) === toLocale(convertGlyph)) {
        if (!silent) {
            void vscode.window.showInformationMessage(
                vscode.l10n.t('Check glyph and convert glyph are the same; nothing to convert.')
            );
        }
        return { status: 'same-glyph' };
    }

    const cts = new vscode.CancellationTokenSource();
    const mine = { cts, silent };
    current = mine;
    let summary: ScanSummary;
    try {
        summary = await vscode.window.withProgress(
            {
                location: silent ? vscode.ProgressLocation.Window : vscode.ProgressLocation.Notification,
                title: vscode.l10n.t('Chinese Expression Diagnostic: scanning…'),
                cancellable: !silent,
            },
            (progress, token) => {
                token.onCancellationRequested(() => cts.cancel());
                return scanScope(scope, progress, cts.token, { files: options.files, yieldBetweenFiles: silent });
            }
        );
    } finally {
        if (current === mine) {current = undefined;}
        cts.dispose();
    }

    if (summary.cancelled) {
        if (!silent) {
            void vscode.window.showInformationMessage(vscode.l10n.t('Scan cancelled.'));
        }
        return { status: 'cancelled' };
    }

    store.set(scope, summary);
    if (silent) {
        return { status: 'done', summary };
    }
    if (summary.files.length === 0) {
        void vscode.window.showInformationMessage(
            summary.scanned === 0
                ? vscode.l10n.t('No supported files found.')
                : vscode.l10n.t('No content to convert in {0} files.', summary.scanned)
        );
    } else {
        await vscode.commands.executeCommand(`${RESULTS_VIEW_ID}.focus`);
    }
    return { status: 'done', summary };
}

export function registerScanCommands(context: vscode.ExtensionContext): ResultsStore {
    const store = new ResultsStore();
    const provider = new ResultsTreeProvider(store);
    const view = vscode.window.createTreeView<ResultNode>(RESULTS_VIEW_ID, { treeDataProvider: provider });
    provider.view = view;

    context.subscriptions.push(
        store,
        view,
        vscode.commands.registerCommand('cslediagnostic.diagnosticAllFiles', () => runScan(store, [])),
        // 资源管理器右键：第一个参数为被点击的资源，第二个参数为全部选中的资源
        vscode.commands.registerCommand('cslediagnostic.diagnosticFolder', (clicked?: vscode.Uri, selected?: vscode.Uri[]) => {
            const scope = selected && selected.length > 0 ? selected : clicked ? [clicked] : [];
            return runScan(store, scope);
        }),
        vscode.commands.registerCommand('cslediagnostic.rescan', () => runScan(store, store.scope)),
        vscode.commands.registerCommand('cslediagnostic.clearResults', () => store.clear()),
        vscode.commands.registerCommand('cslediagnostic.openFinding', async (finding: Finding) => {
            await vscode.window.showTextDocument(finding.uri, { selection: finding.range, preview: true });
        })
    );
    registerAcceptCommands(context, store);
    return store;
}
