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

/**
 * 提取 JSX / TSX 文件中的纯文本节点（排除 { 表达式 }）
 */
export function extractJSXStrings(doc: vscode.TextDocument): { content: string; range: vscode.Range }[] {
    const text = doc.getText();
    const result: { content: string; range: vscode.Range }[] = [];

    // 匹配 JS/TS 字符串字面量表达式
    const stringLiteralPattern = /(`[^`]*?`|"[^"\n]*"|'[^'\n]*')/g;
    let stringLiteralMatch: RegExpExecArray | null;

    while ((stringLiteralMatch = stringLiteralPattern.exec(text))) {
        const start = stringLiteralMatch.index;
        const lineText = doc.lineAt(doc.positionAt(start).line).text;
        if (lineText.trimStart().startsWith('//')) {
            continue;
        }
        const end = stringLiteralPattern.lastIndex;
        const raw = stringLiteralMatch[0];
        result.push({
            content: raw.slice(1, -1),
            range: new vscode.Range(doc.positionAt(start), doc.positionAt(end))
        });
    }

    // 匹配 JSX 标签之间的内容：> ... <
    // 使用非贪婪匹配 + 支持跨行
    const tagAttrPattern = />[\s\S]*?</g;
    let tagAttrMatch: RegExpExecArray | null;

    while ((tagAttrMatch = tagAttrPattern.exec(text))) {
        const raw = tagAttrMatch[0]; // 例如 ">中文<" 或 "> {t('按钮')} <"
        const inner = raw.slice(1, -1).trim(); // 去掉前后的尖括号

        // 跳过空白
        if (!inner) continue;

        // 跳过包含 { 表达式 } 的情况（React 动态内容）
        if (/^{.*}$/.test(inner) || inner.includes('{')) continue;

        // 跳过以注释开始的文本
        const start = tagAttrMatch.index + 1;
        const startPos = doc.positionAt(start);
        const lineText = doc.lineAt(startPos.line).text;
        if (lineText.trimStart().startsWith('//')) continue;

        // 计算范围
        const end = tagAttrMatch.index + tagAttrMatch[0].length - 1;
        const range = new vscode.Range(doc.positionAt(start), doc.positionAt(end));

        result.push({ content: inner, range });
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
