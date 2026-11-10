import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { DictEntry, DictValidation, parseDictionary, removeEntry, upsertEntry, validateSource, validateTarget } from './customDict';
import { openDictionaryPanel } from '../view/dictionaryPanel';
import { getUserConfig } from './config';
import { toLocale } from './utils';

/** 词典按「转换字形」分文件：目录下为 cn.txt / twp.txt / hk.txt / t.txt，与源词字形无关。 */
const LOCALES = ['cn', 'twp', 'hk', 't'] as const;

export const DICTIONARY_TEMPLATE = [
    '# 自定义词典 / Custom dictionary (OpenCC format)',
    '# 一行一条：源词<Tab>目标词1 目标词2（有多个候选时取第一个）；# 开头为注释。',
    '# 源词可以是任意字形的写法，命中即转换为目标词；目标词与源词相同表示固定该词、不做转换。',
    '服务器\t伺服器',
    '软件\t軟體',
    '',
].join('\n');

let storageDir = '';
const entriesByLocale = new Map<string, ReadonlyArray<DictEntry>>();
const changeEmitter = new vscode.EventEmitter<void>();

export const onDidChangeDictionary = changeEmitter.event;

/** 返回转换到字形 `to`（cn / twp / hk / t）时生效的词条。 */
export function getCustomEntries(to: string): Array<[string, string]> {
    return [...(entriesByLocale.get(to) ?? [])];
}

/** 词典目录：设置值（支持 `${workspaceFolder}`，相对路径按首个工作区文件夹解析），留空用扩展存储目录。 */
function dictionaryDirectory(): string {
    const raw = vscode.workspace.getConfiguration('cslediagnostic')
        .get<string>('customDictionaryDirectory', '').trim();
    if (raw === '') {return storageDir;}
    const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
    const expanded = raw.replace(/\$\{workspaceFolder\}/g, folder);
    return path.isAbsolute(expanded) ? expanded : path.resolve(folder, expanded);
}

function dictionaryFile(locale: string): string {
    return path.join(dictionaryDirectory(), `${locale}.txt`);
}

/** 读取并解析目录下的词典文件；文件缺失视为没有词条，格式错误时只弹警告。 */
export async function reloadDictionary(): Promise<void> {
    entriesByLocale.clear();
    for (const locale of LOCALES) {
        const file = dictionaryFile(locale);
        let text: string;
        try {
            text = await fs.readFile(file, 'utf8');
        } catch (e) {
            if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
                void vscode.window.showWarningMessage(vscode.l10n.t('Cannot read custom dictionary: {0}', file));
            }
            continue;
        }
        const { entries, errors } = parseDictionary(text);
        entriesByLocale.set(locale, entries);
        if (errors.length > 0) {
            void vscode.window.showWarningMessage(vscode.l10n.t(
                'Custom dictionary {0}: {1} invalid lines skipped (first: line {2}).',
                file, errors.length, errors[0].line));
        }
    }
    changeEmitter.fire();
}

function currentConvertLocale(): string {
    return toLocale(getUserConfig().convertGlyph);
}

/** 选择词典文件，校验后复制为当前「转换字形」对应的词典。 */
async function importDictionary(): Promise<void> {
    const picked = await vscode.window.showOpenDialog({
        canSelectMany: false,
        filters: { [vscode.l10n.t('Dictionary')]: ['txt', 'tsv'] },
    });
    if (!picked || picked.length === 0) {return;}

    let text: string;
    try {
        text = await fs.readFile(picked[0].fsPath, 'utf8');
    } catch {
        void vscode.window.showErrorMessage(vscode.l10n.t('Cannot read custom dictionary: {0}', picked[0].fsPath));
        return;
    }
    const { entries, errors } = parseDictionary(text);
    if (entries.length === 0) {
        void vscode.window.showErrorMessage(vscode.l10n.t('No valid entries found in the selected file.'));
        return;
    }

    const target = dictionaryFile(currentConvertLocale());
    const exists = await fs.access(target).then(() => true, () => false);
    if (exists) {
        const overwrite = vscode.l10n.t('Overwrite');
        const answer = await vscode.window.showWarningMessage(
            vscode.l10n.t('Overwrite existing dictionary {0}?', target), { modal: true }, overwrite);
        if (answer !== overwrite) {return;}
    }
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, text, 'utf8');
    await reloadDictionary();

    void vscode.window.showInformationMessage(errors.length > 0
        ? vscode.l10n.t('Imported {0} entries; {1} invalid lines skipped.', entries.length, errors.length)
        : vscode.l10n.t('Imported {0} entries.', entries.length));
}

/** 打开当前「转换字形」对应的词典，不存在则用模板创建。 */
async function editDictionary(): Promise<void> {
    const file = dictionaryFile(currentConvertLocale());
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, DICTIONARY_TEMPLATE, { encoding: 'utf8', flag: 'wx' }).catch(e => {
        if ((e as NodeJS.ErrnoException).code !== 'EEXIST') {throw e;}
    });
    await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(vscode.Uri.file(file)));
}

async function readCurrentText(file: string): Promise<string> {
    return fs.readFile(file, 'utf8').catch(() => '');
}

async function writeCurrentText(file: string, text: string): Promise<void> {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, text, 'utf8');
    await reloadDictionary();
}

function validationMessage(code: DictValidation | undefined): string | undefined {
    switch (code) {
        case 'empty': return vscode.l10n.t('Must not be empty');
        case 'tab': return vscode.l10n.t('Must not contain tabs');
        case 'whitespace': return vscode.l10n.t('Must not contain whitespace');
        default: return undefined;
    }
}

/** 面板保存词条：校验后写入当前词典；`oldSource` 与 `source` 不同视为改名。 */
async function saveEntry(oldSource: string | undefined, source: string, target: string): Promise<string | undefined> {
    const from = source.trim();
    const to = target.trim();
    const error = validationMessage(validateSource(from)) ?? validationMessage(validateTarget(to));
    if (error) {return error;}
    const file = dictionaryFile(currentConvertLocale());
    let text = await readCurrentText(file);
    if (oldSource !== undefined && oldSource !== from) {text = removeEntry(text, oldSource);}
    await writeCurrentText(file, upsertEntry(text, from, to));
    return undefined;
}

async function deleteEntry(source: string): Promise<void> {
    const file = dictionaryFile(currentConvertLocale());
    await writeCurrentText(file, removeEntry(await readCurrentText(file), source));
}

/** 去掉字符串字面量两侧的引号与前缀，作为添加词条时 From 的预填值。 */
function stripQuotes(text: string): string {
    return text.replace(/^[rR]?("""|'''|["'`])/, '').replace(/("""|'''|["'`])$/, '');
}

/** 依次输入 From / To，写入当前「转换字形」对应的词典；已有同名源词则替换。 */
async function addEntry(initialSource?: unknown): Promise<boolean> {
    const file = dictionaryFile(currentConvertLocale());
    const glyph = getUserConfig().convertGlyph;

    let prefill = typeof initialSource === 'string' ? stripQuotes(initialSource) : '';
    const editor = vscode.window.activeTextEditor;
    if (prefill === '' && editor && !editor.selection.isEmpty && editor.selection.isSingleLine) {
        prefill = editor.document.getText(editor.selection);
    }

    const source = (await vscode.window.showInputBox({
        title: vscode.l10n.t('Add Custom Dictionary Entry ({0})', glyph),
        prompt: vscode.l10n.t('From: source word (any glyph)'),
        value: prefill.trim(),
        ignoreFocusOut: true,
        validateInput: v => validationMessage(validateSource(v)),
    }))?.trim();
    if (!source) {return false;}

    const text = await readCurrentText(file);
    const existing = parseDictionary(text).entries.find(([s]) => s === source)?.[1];
    const target = (await vscode.window.showInputBox({
        title: vscode.l10n.t('Add Custom Dictionary Entry ({0})', glyph),
        prompt: vscode.l10n.t('To: replacement for "{0}"', source),
        value: existing ?? '',
        ignoreFocusOut: true,
        validateInput: v => validationMessage(validateTarget(v)),
    }))?.trim();
    if (!target) {return false;}

    await writeCurrentText(file, upsertEntry(text, source, target));
    void vscode.window.showInformationMessage(vscode.l10n.t('Saved: {0} → {1}', source, target));
    return true;
}

/** 打开词典管理面板。 */
function manageDictionary(): void {
    openDictionaryPanel({
        async getState() {
            const file = dictionaryFile(currentConvertLocale());
            return {
                glyph: getUserConfig().convertGlyph,
                file,
                entries: parseDictionary(await readCurrentText(file)).entries,
            };
        },
        save: saveEntry,
        remove: deleteEntry,
        importFile: importDictionary,
        openFile: editDictionary,
        onDidChange: onDidChangeDictionary,
    });
}

export async function registerDictionary(context: vscode.ExtensionContext): Promise<void> {
    storageDir = path.join(context.globalStorageUri.fsPath, 'dictionaries');
    await reloadDictionary();

    let watcher: vscode.FileSystemWatcher | undefined;
    const rewatch = () => {
        watcher?.dispose();
        watcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(vscode.Uri.file(dictionaryDirectory()), '*.txt'));
        const reload = () => { void reloadDictionary(); };
        watcher.onDidChange(reload);
        watcher.onDidCreate(reload);
        watcher.onDidDelete(reload);
    };
    rewatch();

    context.subscriptions.push(
        { dispose: () => watcher?.dispose() },
        changeEmitter,
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('cslediagnostic.customDictionaryDirectory')) {
                rewatch();
                void reloadDictionary();
            }
        }),
        vscode.commands.registerCommand('cslediagnostic.importDictionary', importDictionary),
        vscode.commands.registerCommand('cslediagnostic.editDictionary', editDictionary),
        vscode.commands.registerCommand('cslediagnostic.addDictionaryEntry', addEntry),
        vscode.commands.registerCommand('cslediagnostic.manageDictionary', manageDictionary),
    );
}
