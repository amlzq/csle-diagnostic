import * as vscode from 'vscode';
import { Finding } from '../scan/scanDocument';
import { FileFindings, ScanSummary } from '../scan/scanWorkspace';

export const RESULTS_VIEW_ID = 'cslediagnostic.results';
const HAS_RESULTS_CONTEXT = 'cslediagnostic.hasResults';
const EXPAND_FILES_LIMIT = 20;

export type ResultNode =
    | { kind: 'file'; file: FileFindings; expanded: boolean }
    | { kind: 'item'; finding: Finding };

/** 保存最近一次扫描结果与范围，供 TreeView 和后续命令使用 */
export class ResultsStore {
    private readonly emitter = new vscode.EventEmitter<void>();
    readonly onDidChange = this.emitter.event;

    files: FileFindings[] = [];
    scope: vscode.Uri[] = [];
    summary: ScanSummary | undefined;

    get total(): number {
        return this.files.reduce((n, f) => n + f.findings.length, 0);
    }

    set(scope: vscode.Uri[], summary: ScanSummary) {
        this.scope = scope;
        this.summary = summary;
        this.files = summary.files;
        this.update();
    }

    clear() {
        this.files = [];
        this.summary = undefined;
        this.update();
    }

    private update() {
        void vscode.commands.executeCommand('setContext', HAS_RESULTS_CONTEXT, this.files.length > 0);
        this.emitter.fire();
    }

    dispose() {
        this.emitter.dispose();
    }
}

function preview(text: string, max = 30): string {
    const flat = text.replace(/\s+/g, ' ').trim();
    return flat.length > max ? flat.slice(0, max) + '…' : flat;
}

export function describeScope(scope: vscode.Uri[]): string {
    if (scope.length === 0) {return vscode.l10n.t('Workspace');}
    return scope.map(u => vscode.workspace.asRelativePath(u)).join(', ');
}

export class ResultsTreeProvider implements vscode.TreeDataProvider<ResultNode> {
    private readonly emitter = new vscode.EventEmitter<ResultNode | undefined>();
    readonly onDidChangeTreeData = this.emitter.event;
    view: vscode.TreeView<ResultNode> | undefined;

    constructor(private readonly store: ResultsStore) {
        store.onDidChange(() => {
            this.updateMessage();
            this.emitter.fire(undefined);
        });
    }

    private updateMessage() {
        if (!this.view) {return;}
        const { summary } = this.store;
        if (!summary) {
            this.view.message = undefined;
            return;
        }
        let message = vscode.l10n.t(
            'Scope: {0} — {1} findings in {2} files', describeScope(this.store.scope), this.store.total, this.store.files.length
        );
        if (summary.skippedLarge > 0) {
            message += ' · ' + vscode.l10n.t('{0} large files skipped', summary.skippedLarge);
        }
        this.view.message = message;
    }

    getChildren(element?: ResultNode): ResultNode[] {
        if (!element) {
            return this.store.files.map((file, i) => ({ kind: 'file', file, expanded: i < EXPAND_FILES_LIMIT }));
        }
        if (element.kind === 'file') {
            return element.file.findings.map(finding => ({ kind: 'item', finding }));
        }
        return [];
    }

    getParent(element: ResultNode): ResultNode | undefined {
        if (element.kind === 'item') {
            const file = this.store.files.find(f => f.findings.includes(element.finding));
            return file ? { kind: 'file', file, expanded: true } : undefined;
        }
        return undefined;
    }

    getTreeItem(element: ResultNode): vscode.TreeItem {
        if (element.kind === 'file') {
            const { uri, findings } = element.file;
            const item = new vscode.TreeItem(
                vscode.workspace.asRelativePath(uri),
                element.expanded ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed
            );
            item.resourceUri = uri;
            item.iconPath = vscode.ThemeIcon.File;
            item.description = String(findings.length);
            item.contextValue = 'cslediagnostic.file';
            return item;
        }
        const { finding } = element;
        const item = new vscode.TreeItem(
            `L${finding.range.start.line + 1}  ${preview(finding.original)}  →  ${preview(finding.fixed)}`,
            vscode.TreeItemCollapsibleState.None
        );
        const tooltip = new vscode.MarkdownString();
        tooltip.appendCodeblock(finding.original);
        tooltip.appendMarkdown('\n↓\n');
        tooltip.appendCodeblock(finding.fixed);
        item.tooltip = tooltip;
        item.contextValue = 'cslediagnostic.item';
        item.command = {
            command: 'cslediagnostic.openFinding',
            title: vscode.l10n.t('Open'),
            arguments: [finding],
        };
        return item;
    }
}
