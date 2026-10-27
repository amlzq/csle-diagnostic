import * as vscode from 'vscode';
import { applyFindings } from '../scan/applyFindings';
import { Finding, scanDocument } from '../scan/scanDocument';
import { getUserConfig } from '../utils/config';
import { ResultNode, ResultsStore } from '../view/resultsTreeProvider';

async function accept(store: ResultsStore, findings: Finding[]) {
    if (findings.length === 0) {return;}
    const config = vscode.workspace.getConfiguration('cslediagnostic');
    const preview = config.get<boolean>('previewBeforeApply', false);
    const { applied, stale, failed, cancelled } = await applyFindings(findings, {
        preview,
        save: config.get<boolean>('saveAfterApply', false),
    });
    if (cancelled) {return;}

    if (preview) {
        // 用户可能在预览中取消勾选了部分修改，无法得知实际应用了哪些，
        // 因此对涉及的文件重新扫描以得到准确的剩余条目
        await store.rescanFiles(findings.map(f => f.uri), scanDocument);
    } else {
        // 过期条目与已应用条目一并移出列表，避免重复处理；需要时可重新扫描
        store.resolve(findings, applied);
    }

    if (failed) {
        void vscode.window.showErrorMessage(vscode.l10n.t('Failed to apply the changes.'));
    } else if (stale.length > 0) {
        void vscode.window.showWarningMessage(
            vscode.l10n.t('Converted {0}, skipped {1} that changed since the scan. Rescan to refresh.', applied.length, stale.length)
        );
    } else if (findings.length > 1) {
        void vscode.window.showInformationMessage(vscode.l10n.t('Converted {0}.', applied.length));
    }
}

export function registerAcceptCommands(context: vscode.ExtensionContext, store: ResultsStore) {
    context.subscriptions.push(
        vscode.commands.registerCommand('cslediagnostic.acceptAll', async () => {
            const findings = store.files.flatMap(f => f.findings);
            if (findings.length === 0) {return;}
            const apply = vscode.l10n.t('Apply');
            const choice = await vscode.window.showWarningMessage(
                vscode.l10n.t(
                    'Convert {0} items in {1} files to {2}? Files are not saved; you can undo the changes.',
                    findings.length, store.files.length, getUserConfig(store.scope[0]).convertGlyph
                ),
                { modal: true },
                apply
            );
            if (choice === apply) {
                await accept(store, findings);
            }
        }),
        vscode.commands.registerCommand('cslediagnostic.acceptFile', (node?: ResultNode) => {
            if (node?.kind !== 'file') {return;}
            return accept(store, node.file.findings);
        }),
        vscode.commands.registerCommand('cslediagnostic.acceptItem', (node?: ResultNode) => {
            if (node?.kind !== 'item') {return;}
            return accept(store, [node.finding]);
        }),
        vscode.commands.registerCommand('cslediagnostic.dismissItem', (node?: ResultNode) => {
            if (node?.kind !== 'item') {return;}
            store.resolve([node.finding]);
        })
    );
}
