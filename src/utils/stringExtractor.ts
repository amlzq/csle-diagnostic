import * as vscode from 'vscode';
import { parse } from '@babel/parser';
import traverse, { NodePath } from '@babel/traverse';
import * as t from '@babel/types';

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

export function extractWebStrings(doc: vscode.TextDocument): { content: string; range: vscode.Range }[] {
    const text = doc.getText();
    const result: { content: string; range: vscode.Range }[] = [];

    let ast: t.File;
    try {
        ast = parse(text, {
            sourceType: 'module',
            plugins: [
                'jsx',
                'typescript', // 支持 tsx
                'classProperties',
                'objectRestSpread',
                'decorators-legacy',
            ],
            ranges: true,
            errorRecovery: true,
        }) as unknown as t.File;
    } catch (e) {
        console.warn('AST parse error:', e);
        return result;
    }

    traverse(ast, {
        JSXText(path: NodePath<t.JSXText>) {
            const value = path.node.value.trim();
            if (value && /[一-龥]/.test(value)) {
                const [start, end] = path.node.range!;
                result.push({
                    content: value,
                    range: new vscode.Range(doc.positionAt(start), doc.positionAt(end)),
                });
            }
        },
        JSXAttribute(path: NodePath<t.JSXAttribute>) {
            const val = path.node.value;
            if (val && val.type === 'StringLiteral' && /[一-龥]/.test(val.value)) {
                const [start, end] = val.range!;
                result.push({
                    content: val.value,
                    range: new vscode.Range(doc.positionAt(start), doc.positionAt(end)),
                });
            }
        },
        TemplateElement(path: NodePath<t.TemplateElement>) {
            const nodeRange = path.node.range;
            if (!nodeRange) return;
            const [start, end] = nodeRange;
            const range = new vscode.Range(doc.positionAt(start), doc.positionAt(end));
            const value = doc.getText(range);
            if (value && /[一-龥]/.test(value)) {
                result.push({
                    content: value,
                    range,
                });
            }
        },
        StringLiteral(path: NodePath<t.StringLiteral>) {
            // 可选：提取 JSX 外部字符串
            const val = path.node.value;
            if (/[一-龥]/.test(val)) {
                const [start, end] = path.node.range!;
                result.push({
                    content: val,
                    range: new vscode.Range(doc.positionAt(start), doc.positionAt(end)),
                });
            }
        },
    });

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
