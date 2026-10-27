import * as vscode from 'vscode';
import { Finding } from '../scan/scanDocument';
import { FileFindings, ScanSummary } from '../scan/scanWorkspace';
import { shiftFinding } from '../scan/applyFindings';

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

    /**
     * 移除已处理的条目；applied 为其中已写入文档的条目，
     * 用于修正同一行内剩余条目的列号。
     */
    resolve(processed: Finding[], applied: Finding[] = []) {
        const done = new Set(processed);
        this.files = this.files
            .map(file => ({
                uri: file.uri,
                findings: file.findings.filter(f => !done.has(f)).map(f => shiftFinding(f, applied)),
            }))
            .filter(file => file.findings.length > 0);
        this.update();
    }

    /** 重新扫描指定文件并替换其条目（无剩余条目的文件会被移除） */
    async rescanFiles(
        uris: vscode.Uri[],
        scan: (doc: vscode.TextDocument) => Promise<{ findings: Finding[] } | undefined>
    ) {
        const targets = new Map(uris.map(u => [u.toString(), u]));
        const replaced = new Map<string, FileFindings>();
        for (const [key, uri] of targets) {
            const doc = await vscode.workspace.openTextDocument(uri);
            const result = await scan(doc);
            if (result && result.findings.length > 0) {
                replaced.set(key, { uri, findings: result.findings.sort((a, b) => a.range.start.compareTo(b.range.start)) });
            }
        }
        this.files = this.files
            .map(file => replaced.get(file.uri.toString()) ?? (targets.has(file.uri.toString()) ? undefined : file))
            .filter((file): file is FileFindings => file !== undefined);
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
