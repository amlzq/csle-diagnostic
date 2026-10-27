import * as vscode from 'vscode';
import { Finding, scanDocument } from './scanDocument';
import { scanOpenedUris } from './scanState';

export interface FileFindings {
    uri: vscode.Uri;
    findings: Finding[];
}

export interface ScanSummary {
    files: FileFindings[];
    /** 实际扫描的文件数 */
    scanned: number;
    /** 因超过大小限制被跳过的文件数 */
    skippedLarge: number;
    /** 解析 / 读取失败被跳过的文件数 */
    failed: number;
    cancelled: boolean;
}

const SUPPORTED_EXTENSIONS = ['dart', 'js', 'mjs', 'cjs', 'ts', 'jsx', 'tsx', 'html', 'htm', 'css', 'json', 'php', 'py'];
const INCLUDE_GLOB = `**/*.{${SUPPORTED_EXTENSIONS.join(',')}}`;
const DEFAULT_EXCLUDES = [
    '**/node_modules/**', '**/.git/**', '**/out/**', '**/dist/**', '**/build/**',
    '**/.dart_tool/**', '**/*.min.*',
];
const CONCURRENCY = 4;

function buildExcludeGlob(): string {
    const config = vscode.workspace.getConfiguration('cslediagnostic');
    const filesExclude = vscode.workspace.getConfiguration('files').get<Record<string, boolean>>('exclude', {});
    const patterns = [
        ...DEFAULT_EXCLUDES,
        ...Object.entries(filesExclude).filter(([, enabled]) => enabled === true).map(([glob]) => glob),
        ...config.get<string[]>('workspaceExclude', []),
    ];
    return `{${patterns.join(',')}}`;
}

async function isDirectory(uri: vscode.Uri): Promise<boolean> {
    try {
        const stat = await vscode.workspace.fs.stat(uri);
        return (stat.type & vscode.FileType.Directory) !== 0;
    } catch {
        return false;
    }
}

/** 收集范围内的待扫描文件；scope 为空表示整个工作区 */
export async function collectFiles(scope: vscode.Uri[], token?: vscode.CancellationToken): Promise<vscode.Uri[]> {
    const exclude = buildExcludeGlob();
    const found = new Map<string, vscode.Uri>();
    const add = (uris: vscode.Uri[]) => uris.forEach(u => found.set(u.toString(), u));

    if (scope.length === 0) {
        add(await vscode.workspace.findFiles(INCLUDE_GLOB, exclude, undefined, token));
    } else {
        for (const uri of scope) {
            if (await isDirectory(uri)) {
                add(await vscode.workspace.findFiles(new vscode.RelativePattern(uri, INCLUDE_GLOB), exclude, undefined, token));
            } else {
                found.set(uri.toString(), uri);
            }
        }
    }
    return [...found.values()].sort((a, b) => a.fsPath.localeCompare(b.fsPath));
}

async function openForScan(uri: vscode.Uri): Promise<vscode.TextDocument> {
    const key = uri.toString();
    const alreadyOpen = vscode.workspace.textDocuments.find(d => d.uri.toString() === key);
    if (alreadyOpen) {return alreadyOpen;}
    scanOpenedUris.add(key);
    try {
        return await vscode.workspace.openTextDocument(uri);
    } finally {
        scanOpenedUris.delete(key);
    }
}

export interface ScanOptions {
    /** 已收集好的文件列表（来自 collectFiles），传入则不再重复查找文件 */
    files?: vscode.Uri[];
    /** 每处理完一个文件就让出事件循环，降低后台扫描对交互的影响 */
    yieldBetweenFiles?: boolean;
}

export async function scanScope(
    scope: vscode.Uri[],
    progress?: vscode.Progress<{ message?: string; increment?: number }>,
    token?: vscode.CancellationToken,
    options: ScanOptions = {}
): Promise<ScanSummary> {
    const uris = options.files ?? await collectFiles(scope, token);
    const maxBytes = vscode.workspace.getConfiguration('cslediagnostic').get<number>('maxFileSize', 1024) * 1024;
    const summary: ScanSummary = { files: [], scanned: 0, skippedLarge: 0, failed: 0, cancelled: false };

    let next = 0;
    const worker = async () => {
        while (next < uris.length) {
            if (token?.isCancellationRequested) {
                summary.cancelled = true;
                return;
            }
            const uri = uris[next++];
            try {
                const stat = await vscode.workspace.fs.stat(uri);
                if (stat.size > maxBytes) {
                    summary.skippedLarge++;
                    continue;
                }
                const doc = await openForScan(uri);
                const result = await scanDocument(doc);
                summary.scanned++;
                if (result && result.findings.length > 0) {
                    summary.files.push({ uri, findings: result.findings });
                }
            } catch {
                summary.failed++;
            } finally {
                if (options.yieldBetweenFiles) {
                    await new Promise<void>(resolve => setImmediate(resolve));
                }
                progress?.report({
                    message: `${Math.min(next, uris.length)} / ${uris.length}`,
                    increment: uris.length > 0 ? 100 / uris.length : 0,
                });
            }
        }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, uris.length) }, worker));

    if (token?.isCancellationRequested) {
        summary.cancelled = true;
    }

    summary.files.sort((a, b) => a.uri.fsPath.localeCompare(b.uri.fsPath));
    for (const file of summary.files) {
        file.findings.sort((a, b) => a.range.start.compareTo(b.range.start));
    }
    return summary;
}
