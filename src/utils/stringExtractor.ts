import { parse } from '@babel/parser';
import traverse, { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import * as path from 'path';
import * as vscode from 'vscode';

const WebTreeSitter = require('web-tree-sitter') as any;
let treeSitterInitPromise: Promise<void> | null = null;
let dartParserPromise: Promise<any> | null = null;
let htmlParserPromise: Promise<any> | null = null;
let cssParserPromise: Promise<any> | null = null;
let phpParserPromise: Promise<any> | null = null;
let pythonParserPromise: Promise<any> | null = null;

export type ExtractOptions = {
    includeLiteralExpression?: boolean;
    includeDocComment?: boolean;
};

const normalizeOptions = (options?: ExtractOptions) => {
    return {
        includeLiteralExpression: options?.includeLiteralExpression ?? true,
        includeDocComment: options?.includeDocComment ?? false,
    };
};

const getRootDir = (): string => path.resolve(__dirname, '../../');

const ensureTreeSitterInitialized = async (): Promise<void> => {
    if (treeSitterInitPromise) return treeSitterInitPromise;
    treeSitterInitPromise = (async () => {
        const rootDir = getRootDir();
        const treeSitterWasmPath = path.join(rootDir, 'node_modules', 'web-tree-sitter', 'tree-sitter.wasm');
        await WebTreeSitter.Parser.init({
            locateFile: () => treeSitterWasmPath,
        });
    })();
    return treeSitterInitPromise;
};

export async function prewarmTreeSitterRuntime(): Promise<void> {
    try {
        await ensureTreeSitterInitialized();
    } catch { }
}

const getDartParser = async (): Promise<any> => {
    if (dartParserPromise) return dartParserPromise;
    dartParserPromise = (async () => {
        const rootDir = getRootDir();
        const dartLangWasmPath = path.join(rootDir, 'node_modules', 'tree-sitter-dart', 'tree-sitter-dart.wasm');

        await ensureTreeSitterInitialized();

        const lang = await WebTreeSitter.Language.load(dartLangWasmPath);
        const parser = new WebTreeSitter.Parser();
        parser.setLanguage(lang);
        return parser;
    })();
    return dartParserPromise;
};

const getPhpParser = async (): Promise<any> => {
    if (phpParserPromise) return phpParserPromise;
    phpParserPromise = (async () => {
        const rootDir = getRootDir();
        const phpLangWasmPath = path.join(rootDir, 'node_modules', 'tree-sitter-php', 'tree-sitter-php.wasm');

        await ensureTreeSitterInitialized();

        const lang = await WebTreeSitter.Language.load(phpLangWasmPath);
        const parser = new WebTreeSitter.Parser();
        parser.setLanguage(lang);
        return parser;
    })();
    return phpParserPromise;
};

const getHtmlParser = async (): Promise<any> => {
    if (htmlParserPromise) return htmlParserPromise;
    htmlParserPromise = (async () => {
        const rootDir = getRootDir();
        const htmlLangWasmPath = path.join(rootDir, 'node_modules', 'tree-sitter-html', 'tree-sitter-html.wasm');

        await ensureTreeSitterInitialized();

        const lang = await WebTreeSitter.Language.load(htmlLangWasmPath);
        const parser = new WebTreeSitter.Parser();
        parser.setLanguage(lang);
        return parser;
    })();
    return htmlParserPromise;
};

const getCssParser = async (): Promise<any> => {
    if (cssParserPromise) return cssParserPromise;
    cssParserPromise = (async () => {
        const rootDir = getRootDir();
        const cssLangWasmPath = path.join(rootDir, 'node_modules', 'tree-sitter-css', 'tree-sitter-css.wasm');

        await ensureTreeSitterInitialized();

        const lang = await WebTreeSitter.Language.load(cssLangWasmPath);
        const parser = new WebTreeSitter.Parser();
        parser.setLanguage(lang);
        return parser;
    })();
    return cssParserPromise;
};

const getPythonParser = async (): Promise<any> => {
    if (pythonParserPromise) return pythonParserPromise;
    pythonParserPromise = (async () => {
        const rootDir = getRootDir();
        const pythonLangWasmPath = path.join(rootDir, 'node_modules', 'tree-sitter-python', 'tree-sitter-python.wasm');

        await ensureTreeSitterInitialized();

        const lang = await WebTreeSitter.Language.load(pythonLangWasmPath);
        const parser = new WebTreeSitter.Parser();
        parser.setLanguage(lang);
        return parser;
    })();
    return pythonParserPromise;
};

export async function extractDartStrings(
    doc: vscode.TextDocument,
    options?: ExtractOptions
): Promise<{ content: string; range: vscode.Range }[]> {
    const text = doc.getText();
    const result: { content: string; range: vscode.Range }[] = [];
    const { includeLiteralExpression, includeDocComment } = normalizeOptions(options);

    let parser: any;
    try {
        parser = await getDartParser();
    } catch {
        return result;
    }

    let tree: any;
    try {
        tree = parser.parse(text);
    } catch {
        return result;
    }

    const stripDartString = (raw: string): string => {
        if (!raw) return raw;
        const prefixLen = raw[0] === 'r' ? 1 : 0;
        const triple = raw.slice(prefixLen, prefixLen + 3);
        const quoteLen =
            triple === "'''" || triple === '"""'
                ? 3
                : raw[prefixLen] === "'" || raw[prefixLen] === '"'
                    ? 1
                    : 0;
        if (quoteLen === 0) return raw;
        if (raw.length < prefixLen + quoteLen * 2) return raw;
        return raw.slice(prefixLen + quoteLen, raw.length - quoteLen);
    };

    const walk = (node: any) => {
        if (!node) return;

        if (includeLiteralExpression && node.type === 'string_literal') {
            const start = node.startIndex;
            const end = node.endIndex;
            const range = new vscode.Range(doc.positionAt(start), doc.positionAt(end));
            const raw = doc.getText(range);
            result.push({
                content: stripDartString(raw),
                range,
            });
        }

        if (includeDocComment && typeof node.type === 'string' && node.type.includes('comment')) {
            const start = node.startIndex;
            const end = node.endIndex;
            const range = new vscode.Range(doc.positionAt(start), doc.positionAt(end));
            const raw = doc.getText(range);
            if (raw.startsWith('///') || raw.startsWith('/**')) {
                result.push({ content: raw, range });
            }
        }

        for (const child of node.children ?? []) {
            walk(child);
        }
    };

    walk(tree.rootNode);
    return result;
}

export function extractWebStrings(
    doc: vscode.TextDocument,
    options?: ExtractOptions
): { content: string; range: vscode.Range }[] {
    const text = doc.getText();
    const result: { content: string; range: vscode.Range }[] = [];
    const seen = new Set<string>();
    const { includeLiteralExpression, includeDocComment } = normalizeOptions(options);

    const push = (content: string, start: number, end: number) => {
        const key = `${start}:${end}`;
        if (seen.has(key)) return;
        seen.add(key);
        result.push({
            content,
            range: new vscode.Range(doc.positionAt(start), doc.positionAt(end)),
        });
    };

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
            if (!includeLiteralExpression) return;
            const value = path.node.value.trim();
            if (value && /[一-龥]/.test(value)) {
                const [start, end] = path.node.range!;
                push(value, start, end);
            }
        },
        JSXAttribute(path: NodePath<t.JSXAttribute>) {
            if (!includeLiteralExpression) return;
            const val = path.node.value;
            if (val && val.type === 'StringLiteral' && /[一-龥]/.test(val.value)) {
                const [start, end] = val.range!;
                push(val.value, start, end);
            }
        },
        TemplateElement(path: NodePath<t.TemplateElement>) {
            if (!includeLiteralExpression) return;
            const nodeRange = path.node.range;
            if (!nodeRange) return;
            const [start, end] = nodeRange;
            const value = doc.getText(new vscode.Range(doc.positionAt(start), doc.positionAt(end)));
            if (value && /[一-龥]/.test(value)) {
                push(value, start, end);
            }
        },
        StringLiteral(path: NodePath<t.StringLiteral>) {
            if (!includeLiteralExpression) return;
            // 可选：提取 JSX 外部字符串
            const val = path.node.value;
            if (/[一-龥]/.test(val)) {
                const [start, end] = path.node.range!;
                push(val, start, end);
            }
        },
    });

    if (includeDocComment) {
        for (const c of ast.comments ?? []) {
            if (c.type !== 'CommentBlock') continue;
            const start = (c as any).start as number | undefined;
            const end = (c as any).end as number | undefined;
            if (typeof start !== 'number' || typeof end !== 'number') continue;
            const raw = doc.getText(new vscode.Range(doc.positionAt(start), doc.positionAt(end)));
            if (raw.startsWith('/**')) {
                push(raw, start, end);
            }
        }
    }

    return result;
}

export async function extractHtmlStrings(
    doc: vscode.TextDocument,
    options?: ExtractOptions
): Promise<{ content: string; range: vscode.Range }[]> {
    const text = doc.getText();
    const result: { content: string; range: vscode.Range }[] = [];
    const seen = new Set<string>();
    const { includeLiteralExpression, includeDocComment } = normalizeOptions(options);

    if (!includeLiteralExpression && !includeDocComment) return result;

    const pushRange = (start: number, end: number) => {
        if (start >= end) return;
        const key = `${start}:${end}`;
        if (seen.has(key)) return;
        seen.add(key);
        const range = new vscode.Range(doc.positionAt(start), doc.positionAt(end));
        result.push({ content: doc.getText(range), range });
    };

    let parser: any;
    try {
        parser = await getHtmlParser();
    } catch {
        return result;
    }

    let tree: any;
    try {
        tree = parser.parse(text);
    } catch {
        return result;
    }

    const walk = (node: any) => {
        if (!node) return;

        if (includeLiteralExpression && node.type === 'text') {
            pushRange(node.startIndex, node.endIndex);
        } else if (includeLiteralExpression && node.type === 'attribute') {
            const valueNode =
                typeof node.childForFieldName === 'function'
                    ? node.childForFieldName('value')
                    : null;
            if (valueNode) {
                pushRange(valueNode.startIndex, valueNode.endIndex);
            } else {
                for (const child of node.namedChildren ?? []) {
                    if (child.type === 'quoted_attribute_value' || child.type === 'attribute_value') {
                        pushRange(child.startIndex, child.endIndex);
                    }
                }
            }
        } else if (includeDocComment && node.type === 'comment') {
            const start = node.startIndex;
            const end = node.endIndex;
            const range = new vscode.Range(doc.positionAt(start), doc.positionAt(end));
            const raw = doc.getText(range);
            if (raw.startsWith('<!--')) {
                pushRange(start, end);
            }
        }

        for (const child of node.children ?? []) {
            walk(child);
        }
    };

    walk(tree.rootNode);
    return result;
}

export async function extractCssStrings(
    doc: vscode.TextDocument,
    options?: ExtractOptions
): Promise<{ content: string; range: vscode.Range }[]> {
    const text = doc.getText();
    const result: { content: string; range: vscode.Range }[] = [];
    const seen = new Set<string>();
    const { includeLiteralExpression, includeDocComment } = normalizeOptions(options);

    if (!includeLiteralExpression && !includeDocComment) return result;

    const pushRange = (start: number, end: number) => {
        if (start >= end) return;
        const key = `${start}:${end}`;
        if (seen.has(key)) return;
        seen.add(key);
        const range = new vscode.Range(doc.positionAt(start), doc.positionAt(end));
        result.push({ content: doc.getText(range), range });
    };

    let parser: any;
    try {
        parser = await getCssParser();
    } catch {
        return result;
    }

    let tree: any;
    try {
        tree = parser.parse(text);
    } catch {
        return result;
    }

    const shouldCaptureTypes = new Set(['string_value']);

    const walk = (node: any) => {
        if (!node) return;
        if (includeLiteralExpression && shouldCaptureTypes.has(node.type)) {
            pushRange(node.startIndex, node.endIndex);
        } else if (includeDocComment && node.type === 'comment') {
            const start = node.startIndex;
            const end = node.endIndex;
            const range = new vscode.Range(doc.positionAt(start), doc.positionAt(end));
            const raw = doc.getText(range);
            if (raw.startsWith('/*')) {
                pushRange(start, end);
            }
        }
        for (const child of node.children ?? []) {
            walk(child);
        }
    };

    walk(tree.rootNode);
    return result;
}

export async function extractPHPStrings(
    doc: vscode.TextDocument,
    options?: ExtractOptions
): Promise<{ content: string; range: vscode.Range }[]> {
    const text = doc.getText();
    const result: { content: string; range: vscode.Range }[] = [];
    const { includeLiteralExpression, includeDocComment } = normalizeOptions(options);

    let parser: any;
    try {
        parser = await getPhpParser();
    } catch {
        return result;
    }

    let tree: any;
    try {
        tree = parser.parse(text);
    } catch {
        return result;
    }

    const addNodeRange = (node: any) => {
        let start = node.startIndex;
        let end = node.endIndex;
        if (text[end] === ';') end += 1;

        const range = new vscode.Range(doc.positionAt(start), doc.positionAt(end));
        result.push({
            content: doc.getText(range),
            range,
        });
    };

    const shouldCaptureTypes = new Set(['string', 'encapsed_string', 'heredoc', 'nowdoc']);

    const walk = (node: any) => {
        if (!node) return;

        if (includeLiteralExpression && shouldCaptureTypes.has(node.type)) {
            addNodeRange(node);
        } else if (includeDocComment && node.type === 'comment') {
            const start = node.startIndex;
            const end = node.endIndex;
            const range = new vscode.Range(doc.positionAt(start), doc.positionAt(end));
            const raw = doc.getText(range);
            if (raw.startsWith('/**')) {
                result.push({ content: raw, range });
            }
        }

        for (const child of node.children ?? []) {
            walk(child);
        }
    };

    walk(tree.rootNode);
    return result;
}

export async function extractPythonStrings(
    doc: vscode.TextDocument,
    options?: ExtractOptions
): Promise<{ content: string; range: vscode.Range }[]> {
    const text = doc.getText();
    const result: { content: string; range: vscode.Range }[] = [];
    const { includeLiteralExpression, includeDocComment } = normalizeOptions(options);

    let parser: any;
    try {
        parser = await getPythonParser();
    } catch {
        return result;
    }

    let tree: any;
    try {
        tree = parser.parse(text);
    } catch {
        return result;
    }

    const addRange = (start: number, end: number) => {
        if (start >= end) return;
        const range = new vscode.Range(doc.positionAt(start), doc.positionAt(end));
        result.push({ content: doc.getText(range), range });
    };

    const docstringContentRanges = new Set<string>();

    const collectStringContentRanges = (node: any) => {
        if (!node) return;
        if (node.type === 'string_content') {
            docstringContentRanges.add(`${node.startIndex}:${node.endIndex}`);
        }
        for (const child of node.namedChildren ?? []) {
            collectStringContentRanges(child);
        }
    };

    const collectDocstrings = (node: any) => {
        if (!node) return;

        const maybeAddDocstringFromBody = (bodyNode: any) => {
            if (!bodyNode) return;
            const firstStmt = (bodyNode.namedChildren ?? [])[0];
            if (!firstStmt || firstStmt.type !== 'expression_statement') return;
            const firstExpr = (firstStmt.namedChildren ?? [])[0];
            if (!firstExpr || firstExpr.type !== 'string') return;
            collectStringContentRanges(firstExpr);
        };

        if (node.type === 'module') {
            maybeAddDocstringFromBody(node);
        } else if (node.type === 'function_definition' || node.type === 'class_definition') {
            const bodyNode =
                typeof node.childForFieldName === 'function'
                    ? node.childForFieldName('body')
                    : (node.namedChildren ?? []).find((c: any) => c.type === 'block');
            maybeAddDocstringFromBody(bodyNode);
        }

        for (const child of node.namedChildren ?? []) {
            if (child.type === 'function_definition' || child.type === 'class_definition') {
                collectDocstrings(child);
            } else if (child.type === 'module') {
                collectDocstrings(child);
            } else {
                collectDocstrings(child);
            }
        }
    };

    const walk = (node: any) => {
        if (!node) return;
        if (node.type === 'string_content') {
            const key = `${node.startIndex}:${node.endIndex}`;
            const isDocstring = docstringContentRanges.has(key);
            if (isDocstring ? includeDocComment : includeLiteralExpression) {
                addRange(node.startIndex, node.endIndex);
            }
        }
        for (const child of node.namedChildren ?? []) {
            walk(child);
        }
    };

    collectDocstrings(tree.rootNode);
    if (includeLiteralExpression || includeDocComment) {
        walk(tree.rootNode);
    }
    return result;
}
