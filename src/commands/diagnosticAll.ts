import * as vscode from 'vscode';
import { getUserConfig } from '../utils/config';
import { toLocale } from '../utils/utils';
import { Finding } from '../scan/scanDocument';
import { scanScope } from '../scan/scanWorkspace';
import { RESULTS_VIEW_ID, ResultNode, ResultsStore, ResultsTreeProvider } from '../view/resultsTreeProvider';

async function runScan(store: ResultsStore, scope: vscode.Uri[]) {
    const { checkGlyph, convertGlyph } = getUserConfig(scope[0]);
    if (toLocale(checkGlyph) === toLocale(convertGlyph)) {
        void vscode.window.showInformationMessage(
            vscode.l10n.t('Check glyph and convert glyph are the same; nothing to convert.')
        );
        return;
    }

    const summary = await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: vscode.l10n.t('Chinese Expression Diagnostic: scanning…'),
            cancellable: true,
        },
        (progress, token) => scanScope(scope, progress, token)
    );

    if (summary.cancelled) {
        void vscode.window.showInformationMessage(vscode.l10n.t('Scan cancelled.'));
        return;
    }

    store.set(scope, summary);
    if (summary.files.length === 0) {
        void vscode.window.showInformationMessage(
            summary.scanned === 0
                ? vscode.l10n.t('No supported files found.')
                : vscode.l10n.t('No content to convert in {0} files.', summary.scanned)
        );
        return;
    }
    await vscode.commands.executeCommand(`${RESULTS_VIEW_ID}.focus`);
}

export function registerScanCommands(context: vscode.ExtensionContext) {
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
    return store;
}
