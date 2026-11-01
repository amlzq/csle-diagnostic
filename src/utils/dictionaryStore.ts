import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { DictEntry, parseDictionary } from './customDict';

/** 词典按转换目标分文件：`*` 对所有目标生效，其余键对应 opencc 的目标字形。 */
export const DICT_KEYS = ['*', 'cn', 'twp', 'hk', 't'] as const;
type DictKey = typeof DICT_KEYS[number];

export const DICTIONARY_TEMPLATE = [
    '# 自定义词典 / Custom dictionary (OpenCC format)',
    '# 一行一条：源词<Tab>目标词1 目标词2（有多个候选时取第一个）；# 开头为注释。',
    '# 源词按「检查字形」填写；目标词与源词相同表示固定该词、不做转换。',
    '服务器\t伺服器',
    '软件\t軟體',
    '',
].join('\n');

const entriesByKey = new Map<DictKey, ReadonlyArray<DictEntry>>();
const changeEmitter = new vscode.EventEmitter<void>();

export const onDidChangeDictionary = changeEmitter.event;

/** 返回对转换目标 `to`（cn / twp / hk / t）生效的词条：特定目标的词典优先于 `*`。 */
export function getCustomEntries(to: string): Array<[string, string]> {
    const merged = new Map<string, string>();
    for (const key of ['*', to]) {
        for (const [s, t] of entriesByKey.get(key as DictKey) ?? []) {merged.set(s, t);}
    }
    return [...merged];
}

function configuredPaths(): Partial<Record<DictKey, string>> {
    const raw = vscode.workspace.getConfiguration('cslediagnostic')
        .get<Record<string, string>>('customDictionary', {});
    const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
    const result: Partial<Record<DictKey, string>> = {};
    for (const key of DICT_KEYS) {
        const p = raw[key]?.trim();
        if (p) {result[key] = p.replace(/\$\{workspaceFolder\}/g, folder);}
    }
    return result;
}

/** 读取并解析所有已配置的词典文件；文件缺失或有格式错误时不影响基础转换。 */
export async function reloadDictionary(): Promise<void> {
    entriesByKey.clear();
    for (const [key, file] of Object.entries(configuredPaths()) as Array<[DictKey, string]>) {
        try {
            const { entries, errors } = parseDictionary(await fs.readFile(file, 'utf8'));
            entriesByKey.set(key, entries);
            if (errors.length > 0) {
                void vscode.window.showWarningMessage(vscode.l10n.t(
                    'Custom dictionary {0}: {1} invalid lines skipped (first: line {2}).',
                    file, errors.length, errors[0].line));
            }
        } catch {
            void vscode.window.showWarningMessage(vscode.l10n.t('Cannot read custom dictionary: {0}', file));
        }
    }
    changeEmitter.fire();
}

function keyLabel(key: DictKey): string {
    switch (key) {
        case '*': return vscode.l10n.t('All targets');
        case 'cn': return vscode.l10n.t('Simplified Chinese');
        case 'twp': return vscode.l10n.t('Chinese (Taiwan)');
        case 'hk': return vscode.l10n.t('Chinese (Hong Kong)');
        case 't': return vscode.l10n.t('Traditional Chinese');
    }
}

/** 选择目标字形与词典文件，校验后复制到扩展存储目录并写入设置。 */
async function importDictionary(context: vscode.ExtensionContext): Promise<void> {
    const choice = await vscode.window.showQuickPick(
        DICT_KEYS.map(key => ({ label: keyLabel(key), description: key, key })),
        { placeHolder: vscode.l10n.t('Convert target this dictionary applies to') });
    if (!choice) {return;}

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

    const dir = context.globalStorageUri.fsPath;
    await fs.mkdir(dir, { recursive: true });
    const target = path.join(dir, `custom-dictionary.${choice.key === '*' ? 'all' : choice.key}.txt`);
    await fs.writeFile(target, text, 'utf8');
    const config = vscode.workspace.getConfiguration('cslediagnostic');
    const current = config.get<Record<string, string>>('customDictionary', {});
    await config.update('customDictionary', { ...current, [choice.key]: target }, vscode.ConfigurationTarget.Global);
    await reloadDictionary();

    void vscode.window.showInformationMessage(errors.length > 0
        ? vscode.l10n.t('Imported {0} entries; {1} invalid lines skipped.', entries.length, errors.length)
        : vscode.l10n.t('Imported {0} entries.', entries.length));
}

async function openTemplate(): Promise<void> {
    const doc = await vscode.workspace.openTextDocument({ content: DICTIONARY_TEMPLATE, language: 'plaintext' });
    await vscode.window.showTextDocument(doc);
}

export async function registerDictionary(context: vscode.ExtensionContext): Promise<void> {
    await reloadDictionary();

    let watchers: vscode.FileSystemWatcher[] = [];
    const rewatch = () => {
        watchers.forEach(w => w.dispose());
        watchers = Object.values(configuredPaths()).map(file => {
            const w = vscode.workspace.createFileSystemWatcher(
                new vscode.RelativePattern(vscode.Uri.file(path.dirname(file)), path.basename(file)));
            const reload = () => { void reloadDictionary(); };
            w.onDidChange(reload);
            w.onDidCreate(reload);
            w.onDidDelete(reload);
            return w;
        });
    };
    rewatch();

    context.subscriptions.push(
        { dispose: () => watchers.forEach(w => w.dispose()) },
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
