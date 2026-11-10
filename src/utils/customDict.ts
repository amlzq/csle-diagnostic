/**
 * 用户自定义词典：沿用 OpenCC 原生词典（贡献词条）格式。
 * 每行 `源词<Tab>目标词1 目标词2 …`，目标词有多个候选时取第一个，与 OpenCC 一致。
 * 额外容忍：`#` 开头的注释行、空行、UTF-8 BOM、CRLF。
 * 目标字形不在文件内表达，而是像 OpenCC 一样按文件区分（见 dictionaryStore）。
 * opencc-js 运行时只接受 `[源词, 目标词]` 单值词对，这里即是两者之间的转换层。
 */
export type DictEntry = [source: string, target: string];

export interface DictParseError {
    line: number;
    message: string;
}

export interface DictParseResult {
    entries: DictEntry[];
    errors: DictParseError[];
}

export function parseDictionary(text: string): DictParseResult {
    const map = new Map<string, string>();
    const errors: DictParseError[] = [];
    const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);

    lines.forEach((raw, idx) => {
        const line = raw.trim();
        if (line === '' || line.startsWith('#')) {return;}
        const tab = raw.indexOf('\t');
        if (tab < 0) {
            errors.push({ line: idx + 1, message: 'missing tab separator' });
            return;
        }
        const source = raw.slice(0, tab).trim();
        const target = raw.slice(tab + 1).trim().split(/\s+/)[0] ?? '';
        if (source === '' || target === '') {
            errors.push({ line: idx + 1, message: 'empty source or target' });
            return;
        }
        // 后出现的同名词条覆盖先出现的
        map.set(source, target);
    });

    return { entries: [...map], errors };
}

function lineSource(line: string): string | undefined {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) {return undefined;}
    const tab = line.indexOf('\t');
    return tab < 0 ? undefined : line.slice(0, tab).trim();
}

function splitLines(text: string): { lines: string[]; eol: string } {
    const eol = text.includes('\r\n') ? '\r\n' : '\n';
    const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
    if (lines[lines.length - 1] === '') {lines.pop();}
    return { lines, eol };
}

function joinLines(lines: string[], eol: string): string {
    return lines.length === 0 ? '' : lines.join(eol) + eol;
}

/** 在词典文本中新增或替换一个词条，保留注释与其余内容；同名源词只留一条。 */
export function upsertEntry(text: string, source: string, target: string): string {
    const { lines, eol } = splitLines(text);
    const entry = `${source}\t${target}`;
    let last = -1;
    lines.forEach((line, i) => { if (lineSource(line) === source) {last = i;} });
    if (last < 0) {
        lines.push(entry);
        last = lines.length - 1;
    } else {
        lines[last] = entry;
    }
    return joinLines(lines.filter((line, i) => i === last || lineSource(line) !== source), eol);
}

/** 从词典文本中删除指定源词的所有词条。 */
export function removeEntry(text: string, source: string): string {
    const { lines, eol } = splitLines(text);
    return joinLines(lines.filter(line => lineSource(line) !== source), eol);
}

export type DictValidation = 'empty' | 'tab' | 'whitespace';

/** 校验 From（源词）：不能为空，不能含制表符。 */
export function validateSource(value: string): DictValidation | undefined {
    if (value.trim() === '') {return 'empty';}
    return /\t/.test(value) ? 'tab' : undefined;
}

/** 校验 To（目标词）：不能为空，不能含空白（OpenCC 以空白分隔多个候选）。 */
export function validateTarget(value: string): DictValidation | undefined {
    if (value.trim() === '') {return 'empty';}
    return /\s/.test(value.trim()) ? 'whitespace' : undefined;
}

const TARGET_NAMES: Record<string, [en: string, zh: string]> = {
    cn: ['Simplified Chinese', '简体中文'],
    twp: ['Chinese (Taiwan)', '中文（台湾）'],
    hk: ['Chinese (Hong Kong)', '中文（香港）'],
    t: ['Traditional Chinese', '繁体中文'],
};

/** 把模板里的 `{target}`（英文名）与 `{目标}`（中文名）替换为指定转换字形的名称。 */
export function renderTemplate(template: string, locale: string): string {
    const [en, zh] = TARGET_NAMES[locale] ?? TARGET_NAMES.t;
    return template.replace(/\{target\}/g, en).replace(/\{目标\}/g, zh);
}
