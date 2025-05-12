import * as vscode from 'vscode';

export function shouldExclude(
    doc: vscode.TextDocument,
    range: vscode.Range,
    methods: string[]
): boolean {
    const line = doc.lineAt(range.start.line).text;
    const before = line.slice(0, range.start.character);
    const match = before.match(/([\w$.]+)\s*\($/);
    if (match) {
        return methods.includes(match[1]);
    }
    return false;
}
