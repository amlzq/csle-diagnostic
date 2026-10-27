import * as vscode from 'vscode';
import { collectFiles } from '../scan/scanWorkspace';
import { RESULTS_VIEW_ID, ResultsStore } from '../view/resultsTreeProvider';
import { cancelSilentScan, runScan } from './diagnosticAll';

const DEFAULT_DELAY_MS = 3000;

export interface AutoDiagnosticDeps {
    /** 启动后等待多久再开始扫描，避开启动期的 CPU 高峰 */
    delayMs?: number;
    run?: typeof runScan;
    collect?: typeof collectFiles;
    /** 是否满足自动扫描的前置条件（有工作区文件夹且已受信任） */
    canRun?: () => boolean;
    showInfo?: (message: string, ...items: string[]) => Thenable<string | undefined>;
}

export interface AutoDiagnosticHandle extends vscode.Disposable {
    /** 当前已排队 / 正在执行的自动扫描完成后 resolve（主要供测试使用） */
    idle(): Promise<void>;
}

const defaultCanRun = () =>
    (vscode.workspace.workspaceFolders?.length ?? 0) > 0 && vscode.workspace.isTrusted;

const isEnabled = () =>
    vscode.workspace.getConfiguration('cslediagnostic').get<boolean>('autoDiagnosticOnOpen', false);

/**
 * 打开项目后自动诊断整个工作区（默认关闭）。
 * 只扫描，不修改文件；每个窗口会话成功自动扫描一次。
 */
export function scheduleAutoDiagnostic(
    store: ResultsStore,
    deps: AutoDiagnosticDeps = {}
): AutoDiagnosticHandle {
    const delayMs = deps.delayMs ?? DEFAULT_DELAY_MS;
    const run = deps.run ?? runScan;
    const collect = deps.collect ?? collectFiles;
    const canRun = deps.canRun ?? defaultCanRun;
    const showInfo = deps.showInfo ?? ((m, ...items) => vscode.window.showInformationMessage(m, ...items));

    let finished = false;
    let timer: NodeJS.Timeout | undefined;
    let pending: Promise<void> = Promise.resolve();
    let release: (() => void) | undefined;

    const cancelTimer = () => {
        if (timer) {
            clearTimeout(timer);
            timer = undefined;
        }
        release?.();
        release = undefined;
    };

    const execute = async () => {
        if (!isEnabled() || !canRun() || store.files.length > 0) {return;}

        const files = await collect([]);
        if (files.length === 0) {
            finished = true;
            return;
        }

        const maxFiles = vscode.workspace.getConfiguration('cslediagnostic').get<number>('autoDiagnosticMaxFiles', 5000);
        if (files.length > maxFiles) {
            finished = true;
            const openSettings = vscode.l10n.t('Open Settings');
            const choice = await showInfo(
                vscode.l10n.t(
                    'Found {0} files, which exceeds the auto-diagnostic limit of {1}; skipped. Run "Diagnostic All Files" manually, or adjust workspaceExclude / autoDiagnosticMaxFiles.',
                    files.length, maxFiles
                ),
                openSettings
            );
            if (choice === openSettings) {
                void vscode.commands.executeCommand('workbench.action.openSettings', 'cslediagnostic.autoDiagnostic');
            }
            return;
        }

        const outcome = await run(store, [], { silent: true, files });
        // 被取消 / 被其它扫描占用时允许之后再次尝试
        finished = outcome.status === 'done' || outcome.status === 'same-glyph';
        if (outcome.status !== 'done' || outcome.summary.files.length === 0) {return;}

        const view = vscode.l10n.t('View Results');
        const choice = await showInfo(
            vscode.l10n.t('Found {0} items to convert in {1} files.', store.total, store.files.length),
            view,
            vscode.l10n.t('Dismiss')
        );
        if (choice === view) {
            await vscode.commands.executeCommand(`${RESULTS_VIEW_ID}.focus`);
        }
    };

    const evaluate = () => {
        if (!isEnabled()) {
            cancelTimer();
            cancelSilentScan();
            return;
        }
        if (finished || timer || !canRun()) {return;}
        pending = new Promise<void>(resolve => {
            release = resolve;
            timer = setTimeout(() => {
                timer = undefined;
                release = undefined;
                execute().catch(() => undefined).finally(resolve);
            }, delayMs);
        });
    };

    const disposables = [
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('cslediagnostic.autoDiagnosticOnOpen')) {evaluate();}
        }),
        vscode.workspace.onDidGrantWorkspaceTrust(evaluate),
    ];
    evaluate();

    return {
        idle: () => pending,
        dispose() {
            cancelTimer();
            cancelSilentScan();
            disposables.forEach(d => d.dispose());
        },
    };
}
