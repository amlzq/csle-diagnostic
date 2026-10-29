import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { DictEntry, parseDictionary, selectEntries } from './customDict';

const STORED_FILE_NAME = 'custom-dictionary.txt';

export const DICTIONARY_TEMPLATE = [
    '# Chinese Expression Diagnostic - custom dictionary',
    '# 自定义词典：一行一条，格式为「源词<Tab>目标词」，# 开头为注释。',
    '# Format: source<Tab>target. Lines starting with # are comments.',
    '# 源词应使用「检查字形」的写法；用户词条优先于内置转换。',
    '# 目标词与源词相同则表示固定该词、不做转换。',
    '# 可选第三列为目标字形（cn / twp / hk / t）：仅在转换为该字形时生效，优先于未指定的同名词条。',
    '#',
    '# 服务器\t伺服器',
    '# 软件\t軟體\ttwp',
    '# 软件\t軟件\thk',
    '',
].join('\n');

let entries: ReadonlyArray<DictEntry> = [];
const changeEmitter = new vscode.EventEmitter<void>();

export const onDidChangeDictionary = changeEmitter.event;

/** 返回对转换目标 `to`（cn / twp / hk / t）生效的词条。 */
export function getCustomEntries(to: string): Array<[string, string]> {
    return selectEntries(entries, to);
}

function resolveConfiguredPath(): string | undefined {
    const raw = vscode.workspace.getConfiguration('cslediagnostic').get<string>('customDictionary', '').trim();
    if (raw === '') {return undefined;}
    const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
    return raw.replace(/\$\{workspaceFolder\}/g, folder);
}

/** 读取并解析词典，更新缓存；文件缺失或有格式错误时不影响基础转换。 */
export async function reloadDictionary(): Promise<void> {
    const file = resolveConfiguredPath();
    let next: ReadonlyArray<DictEntry> = [];
    if (file) {
        try {
            const { entries: parsed, errors } = parseDictionary(await fs.readFile(file, 'utf8'));
            next = parsed;
            if (errors.length > 0) {
                void vscode.window.showWarningMessage(vscode.l10n.t(
                    'Custom dictionary: {0} invalid lines skipped (first: line {1}).',
                    errors.length, errors[0].line));
            }
        } catch {
            void vscode.window.showWarningMessage(vscode.l10n.t(
                'Cannot read custom dictionary: {0}', file));
        }
    }
    entries = next;
    changeEmitter.fire();
}

/** 选择词典文件，校验后复制到扩展存储目录并写入设置。 */
async function importDictionary(context: vscode.ExtensionContext): Promise<void> {
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
    const { entries: parsed, errors } = parseDictionary(text);
    if (parsed.length === 0) {
        void vscode.window.showErrorMessage(vscode.l10n.t('No valid entries found in the selected file.'));
        return;
    }

    const dir = context.globalStorageUri.fsPath;
    await fs.mkdir(dir, { recursive: true });
    const target = path.join(dir, STORED_FILE_NAME);
    await fs.writeFile(target, text, 'utf8');
    await vscode.workspace.getConfiguration('cslediagnostic')
        .update('customDictionary', target, vscode.ConfigurationTarget.Global);
    await reloadDictionary();

    const msg = errors.length > 0
        ? vscode.l10n.t('Imported {0} entries; {1} invalid lines skipped.', parsed.length, errors.length)
        : vscode.l10n.t('Imported {0} entries.', parsed.length);
    void vscode.window.showInformationMessage(msg);
}

async function openTemplate(): Promise<void> {
    const doc = await vscode.workspace.openTextDocument({ content: DICTIONARY_TEMPLATE, language: 'plaintext' });
    await vscode.window.showTextDocument(doc);
}

export async function registerDictionary(context: vscode.ExtensionContext): Promise<void> {
    await reloadDictionary();

    let watcher: vscode.FileSystemWatcher | undefined;
    const rewatch = () => {
        watcher?.dispose();
        watcher = undefined;
        const file = resolveConfiguredPath();
        if (!file) {return;}
        watcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(vscode.Uri.file(path.dirname(file)), path.basename(file)));
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
            if (e.affectsConfiguration('cslediagnostic.customDictionary')) {
                rewatch();
                void reloadDictionary();
            }
        }),
        vscode.commands.registerCommand('cslediagnostic.importDictionary', () => importDictionary(context)),
        vscode.commands.registerCommand('cslediagnostic.openDictionaryTemplate', openTemplate),
    );
}
