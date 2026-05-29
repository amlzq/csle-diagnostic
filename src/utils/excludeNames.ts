import * as vscode from 'vscode';

type CandidateKind = 'call' | 'key' | 'member' | 'selfKey' | 'tag';

type Candidate = {
    name: string;
    kind: CandidateKind;
};

const getLastSegment = (name: string) => {
    const idx = name.lastIndexOf('.');
    return idx >= 0 ? name.slice(idx + 1) : name;
};

const stripWrappingQuotes = (text: string) => {
    const trimmed = text.trim();
    if (trimmed.length < 2) return trimmed;

    const triples = ['"""', "'''"];
    for (const q of triples) {
        if (trimmed.startsWith(q) && trimmed.endsWith(q) && trimmed.length >= q.length * 2) {
            return trimmed.slice(q.length, -q.length);
        }
    }

    const first = trimmed[0];
    const last = trimmed[trimmed.length - 1];
    if (first === last && (first === '"' || first === "'" || first === '`')) {
        return trimmed.slice(1, -1);
    }
    return trimmed;
};

const matchCandidateFromBeforeValue = (before: string): Candidate | null => {
    const s = before.slice(Math.max(0, before.length - 200));

    const callMatch = s.match(/([\w$.]+)\s*\($/);
    if (callMatch) return { kind: 'call', name: callMatch[1] };

    const phpArrayMatch = s.match(/(["'])([^"']+)\1\s*=>\s*$/);
    if (phpArrayMatch) return { kind: 'key', name: phpArrayMatch[2] };

    const quotedKeyMatch = s.match(/(["'])([^"']+)\1\s*:\s*$/);
    if (quotedKeyMatch) return { kind: 'key', name: quotedKeyMatch[2] };

    const colonKeyMatch = s.match(/([\w$.-]+)\s*:\s*$/);
    if (colonKeyMatch) return { kind: 'key', name: colonKeyMatch[1] };

    const equalMatch = s.match(/([\w$.-]+)\s*=\s*$/);
    if (equalMatch) return { kind: 'member', name: equalMatch[1] };

    return null;
};

const findEnclosingTagName = (doc: vscode.TextDocument, startOffset: number): string | null => {
    const windowSize = 4000;
    const windowStart = Math.max(0, startOffset - windowSize);
    const beforeText = doc.getText(
        new vscode.Range(doc.positionAt(windowStart), doc.positionAt(startOffset))
    );

    let idx = beforeText.length - 1;
    while (idx >= 0) {
        const lt = beforeText.lastIndexOf('<', idx);
        if (lt < 0) return null;

        const next = beforeText[lt + 1];
        if (next === '!' || next === '?') {
            idx = lt - 1;
            continue;
        }
        if (next === '/') {
            idx = lt - 1;
            continue;
        }

        let i = lt + 1;
        let name = '';
        while (i < beforeText.length) {
            const ch = beforeText[i];
            if (/[A-Za-z0-9:_-]/.test(ch)) {
                name += ch;
                i += 1;
                continue;
            }
            break;
        }

        if (!name) {
            idx = lt - 1;
            continue;
        }

        return name;
    }

    return null;
};

export function shouldExclude(
    doc: vscode.TextDocument,
    range: vscode.Range,
    excludeNames: string[]
): boolean {
    if (!excludeNames || excludeNames.length === 0) return false;
    const excluded = new Set(excludeNames);

    const startLine = doc.lineAt(range.start.line).text;
    const endLine = doc.lineAt(range.end.line).text;

    const before = startLine.slice(0, range.start.character);
    const after = endLine.slice(range.end.character);

    const candidates: Candidate[] = [];

    const fromBefore = matchCandidateFromBeforeValue(before);
    if (fromBefore) candidates.push(fromBefore);

    if (/^\s*(?::|=>)\b/.test(after)) {
        const raw = doc.getText(range);
        const key = stripWrappingQuotes(raw);
        if (key) candidates.push({ kind: 'selfKey', name: key });
    }

    const startOffset = doc.offsetAt(range.start);
    const tagName = findEnclosingTagName(doc, startOffset);
    if (tagName) candidates.push({ kind: 'tag', name: tagName });

    for (const c of candidates) {
        if (excluded.has(c.name)) return true;
        if (c.kind === 'tag' && excluded.has(c.name.toLowerCase())) return true;
        if (c.kind !== 'call') {
            const last = getLastSegment(c.name);
            if (last !== c.name && excluded.has(last)) return true;
        }
    }
    return false;
}
