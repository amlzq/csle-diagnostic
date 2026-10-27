import * as vscode from 'vscode';
import { Finding } from './scanDocument';

export interface ApplyResult {
    /** 已成功写入编辑的条目 */
    applied: Finding[];
    /** 文档已变化（原文不匹配或范围重叠）而跳过的条目 */
    stale: Finding[];
    /** WorkspaceEdit 被拒绝（此时 applied 为空） */
    failed: boolean;
}

/**
 * 以单个 WorkspaceEdit 原子地应用所有条目（可整体撤销，不保存文件）。
 * 应用前会重新核对文档中的原文，扫描之后被修改过的条目会被跳过。
 */
export async function applyFindings(findings: Finding[]): Promise<ApplyResult> {
    const result: ApplyResult = { applied: [], stale: [], failed: false };
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
            edit.replace(f.uri, f.range, f.fixed);
            result.applied.push(f);
            lastEnd = f.range.end;
        }
    }

    if (result.applied.length > 0 && !(await vscode.workspace.applyEdit(edit))) {
        result.stale.push(...result.applied);
        result.applied = [];
        result.failed = true;
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
