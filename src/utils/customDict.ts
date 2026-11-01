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
