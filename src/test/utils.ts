import * as assert from 'assert';
import * as vscode from 'vscode';

export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export function getCsleDiagnostics(uri: vscode.Uri): vscode.Diagnostic[] {
    return vscode.languages
        .getDiagnostics(uri)
        .filter(d => d.code === 'csle-convert');
}

export async function waitForDiagnostics(
    uri: vscode.Uri,
    timeoutMs = 8000
): Promise<vscode.Diagnostic[]> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        const diagnostics = getCsleDiagnostics(uri);
        if (diagnostics.length > 0) return diagnostics;
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    return getCsleDiagnostics(uri);
}

export async function waitForDiagnosticsCount(
    uri: vscode.Uri,
    expectedCount: number,
    timeoutMs = 8000
): Promise<vscode.Diagnostic[]> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        const diagnostics = getCsleDiagnostics(uri);
        if (diagnostics.length === expectedCount) {
            if (expectedCount === 0) {
                await delay(300);
                const after = getCsleDiagnostics(uri);
                if (after.length === 0) return after;
            } else {
                return diagnostics;
            }
        }
        await delay(100);
    }
    return getCsleDiagnostics(uri);
}

export async function applyPreferredFix(doc: vscode.TextDocument, diagnostic: vscode.Diagnostic) {
    const actions = await vscode.commands.executeCommand<vscode.CodeAction[]>(
        'vscode.executeCodeActionProvider',
        doc.uri,
        diagnostic.range
    );
    assert.ok(actions && actions.length > 0, '应提供至少一个 Quick Fix');
    const fix = actions.find(a => (a.diagnostics ?? []).some(d => d.code === 'csle-convert')) ?? actions[0];
    assert.ok(!!fix.edit, '修复操作应包含 edit');
    await vscode.workspace.applyEdit(fix.edit as vscode.WorkspaceEdit);
}

export async function applyPreferredFixes(doc: vscode.TextDocument, diagnostics: vscode.Diagnostic[]) {
    const sorted = [...diagnostics].sort((a, b) => doc.offsetAt(b.range.start) - doc.offsetAt(a.range.start));
    for (const d of sorted) {
        await applyPreferredFix(doc, d);
    }
}

export async function withConfig<T>(
    updates: Record<string, unknown>,
    fn: () => Promise<T>
): Promise<T> {
    const config = vscode.workspace.getConfiguration('cslediagnostic');
    const previous = new Map<string, unknown>();
    for (const key of Object.keys(updates)) {
        previous.set(key, config.get(key));
        await config.update(key, updates[key], vscode.ConfigurationTarget.Global);
    }
    await delay(200);
    try {
        return await fn();
    } finally {
        for (const [key, value] of previous.entries()) {
            await config.update(key, value as any, vscode.ConfigurationTarget.Global);
        }
        await delay(200);
    }
}
