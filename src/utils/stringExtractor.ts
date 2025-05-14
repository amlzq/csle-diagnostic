import * as vscode from 'vscode';

export function extractDartStrings(doc: vscode.TextDocument): { content: string; range: vscode.Range }[] {
    const text = doc.getText();
    const result: { content: string; range: vscode.Range }[] = [];
    const pattern = /("""[\s\S]*?"""|'''[\s\S]*?'''|"[^"\n]*"|'[^'\n]*')/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text))) {
        const start = match.index;
        const lineText = doc.lineAt(doc.positionAt(start).line).text;
        if (lineText.trimStart().startsWith('//')) {
            continue;
        }
        const end = pattern.lastIndex;
        const raw = match[0];
        const quoteLen = raw.startsWith('"""') || raw.startsWith("'''") ? 3 : 1;
        result.push({
            content: raw.slice(quoteLen, -quoteLen),
            range: new vscode.Range(doc.positionAt(start), doc.positionAt(end))
        });
    }
    return result;
}

export function extractJSStrings(doc: vscode.TextDocument): { content: string; range: vscode.Range }[] {
    const text = doc.getText();
    const result: { content: string; range: vscode.Range }[] = [];
    const pattern = /(`[^`]*?`|"[^"\n]*"|'[^'\n]*')/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text))) {
        const start = match.index;
        const lineText = doc.lineAt(doc.positionAt(start).line).text;
        if (lineText.trimStart().startsWith('//')) {
            continue;
        }
        const end = pattern.lastIndex;
        const raw = match[0];
        result.push({
            content: raw.slice(1, -1),
            range: new vscode.Range(doc.positionAt(start), doc.positionAt(end))
        });
    }
    return result;
}

export function extractPHPStrings(doc: vscode.TextDocument): { content: string; range: vscode.Range }[] {
    const text = doc.getText();
    const result: { content: string; range: vscode.Range }[] = [];
    const pattern = /("[^"\\\n]*"|'[^'\\\n]*'|<<<\s*(\w+)[\s\S]*?^\2;)/gm;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text))) {
        const start = match.index;
        const lineText = doc.lineAt(doc.positionAt(start).line).text;
        if (lineText.trimStart().startsWith('//')) {
            continue;
        }
        const end = pattern.lastIndex;
        const raw = match[0];
        const quote = raw[0];
        let content = '';
        if (quote === '"' || quote === "'") {
            content = raw.slice(1, -1);
        } else if (raw.startsWith('<<<')) {
            const lines = raw.split('\n');
            const endIdx = lines.findIndex((line, i) => i > 0 && /^\w+;/.test(line.trim()));
            if (endIdx > 0) content = lines.slice(1, endIdx).join('\n');
        }
        result.push({
            content,
            range: new vscode.Range(doc.positionAt(start), doc.positionAt(end))
        });
    }
    return result;
}

export function extractPythonStrings(doc: vscode.TextDocument): { content: string; range: vscode.Range }[] {
    const text = doc.getText();
    const result: { content: string; range: vscode.Range }[] = [];
    const pattern = /(?:r|R)?('''[\s\S]*?'''|"""[\s\S]*?"""|'[^'\n]*'|"[^"\n]*")/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text))) {
        const start = match.index;
        const lineText = doc.lineAt(doc.positionAt(start).line).text;
        if (lineText.trimStart().startsWith('#')) {
            continue;
        }
        const end = pattern.lastIndex;
        const raw = match[0];
        const isTriple = raw.startsWith("'''") || raw.startsWith('"""') || raw.startsWith("r'''") || raw.startsWith('r"""');
        const isRaw = raw.startsWith('r') || raw.startsWith('R');
        const quoteLen = isTriple ? 3 : 1;
        const offset = isRaw ? 1 : 0;
        const content = raw.slice(offset + quoteLen, -quoteLen);
        result.push({
            content,
            range: new vscode.Range(doc.positionAt(start), doc.positionAt(end))
        });
    }
    return result;
}
