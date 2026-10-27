import * as vscode from 'vscode';
import { Finding } from './scanDocument';

export interface ApplyResult {
    /** 已成功写入编辑的条目 */
    applied: Finding[];
    /** 文档已变化（原文不匹配或范围重叠）而跳过的条目 */
    stale: Finding[];
    /** WorkspaceEdit 被拒绝（此时 applied 为空） */
    failed: boolean;
    /** 用户在 Refactor Preview 中取消（此时 applied 为空，列表应保持不变） */
    cancelled: boolean;
}

export interface ApplyOptions {
    /** 通过 VS Code 内置 Refactor Preview 让用户二次确认 */
    preview?: boolean;
    /** 应用后保存被修改的文件 */
    save?: boolean;
}

/**
 * 以单个 WorkspaceEdit 原子地应用所有条目（可整体撤销，不保存文件）。
 * 应用前会重新核对文档中的原文，扫描之后被修改过的条目会被跳过。
 */
export async function applyFindings(findings: Finding[], options: ApplyOptions = {}): Promise<ApplyResult> {
    const result: ApplyResult = { applied: [], stale: [], failed: false, cancelled: false };
    const metadata = options.preview
        ? { needsConfirmation: true, label: vscode.l10n.t('Chinese Expression Diagnostic') }
        : undefined;
    const byUri = new Map<string, Finding[]>();
    for (const f of findings) {
        const key = f.uri.toString();
        byUri.set(key, [...(byUri.get(key) ?? []), f]);
    }

    const edit = new vscode.WorkspaceEdit();
    for (const group of byUri.values()) {
        const doc = await vscode.workspace.openTextDocument(group[0].uri);
        const sorted = [...group].sort((a, b) => a.range.start.compareTo(b.range.start));
        let lastEnd: vscode.Position | undefined;
        for (const f of sorted) {
            const overlaps = lastEnd !== undefined && f.range.start.isBefore(lastEnd);
            if (overlaps || doc.getText(f.range) !== f.original) {
                result.stale.push(f);
                continue;
            }
            edit.replace(f.uri, f.range, f.fixed, metadata);
            result.applied.push(f);
            lastEnd = f.range.end;
        }
    }

    if (result.applied.length > 0) {
        if (await vscode.workspace.applyEdit(edit)) {
            if (options.save) {
                const uris = new Map(result.applied.map(f => [f.uri.toString(), f.uri]));
                for (const uri of uris.values()) {
                    const doc = vscode.workspace.textDocuments.find(d => d.uri.toString() === uri.toString());
                    await doc?.save();
                }
            }
        } else {
            // 预览模式下返回 false 通常是用户取消；否则视为失败
            result.stale.push(...result.applied);
            result.applied = [];
            result.cancelled = !!options.preview;
            result.failed = !options.preview;
        }
    }
    return result;
}

/**
 * 同一行上位于已应用编辑之后的条目，其列号会因文本长度变化而偏移。
 * 转换不改变换行数，因此只需按行内偏移量修正。
 */
export function shiftFinding(finding: Finding, applied: Finding[]): Finding {
    let delta = 0;
    for (const a of applied) {
        if (a.uri.toString() !== finding.uri.toString()) {continue;}
        if (a.range.end.line !== finding.range.start.line) {continue;}
        if (a.range.end.isAfter(finding.range.start)) {continue;}
        const newEnd = a.fixed.includes('\n')
            ? a.fixed.slice(a.fixed.lastIndexOf('\n') + 1).length
            : a.range.start.character + a.fixed.length;
        delta += newEnd - a.range.end.character;
    }
    if (delta === 0) {return finding;}
    const start = finding.range.start.translate(0, delta);
    const end = finding.range.end.line === finding.range.start.line
        ? finding.range.end.translate(0, delta)
        : finding.range.end;
    return { ...finding, range: new vscode.Range(start, end) };
}
