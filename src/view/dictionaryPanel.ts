import * as vscode from 'vscode';
import { buildPanelHtml } from './dictionaryPanelHtml';

export interface PanelState {
    file: string;
    entries: Array<[string, string]>;
}

/** 面板自己选择的字形（locale）决定操作哪份词典，与设置里的转换字形不联动。 */
export interface PanelBackend {
    locales: Array<{ value: string; label: string }>;
    initialLocale: string;
    getState(locale: string): Promise<PanelState>;
    /** 保存词条，`oldSource` 存在且不同于 `source` 时视为改名；返回错误信息（成功则 undefined）。 */
    save(locale: string, oldSource: string | undefined, source: string, target: string): Promise<string | undefined>;
    remove(locale: string, source: string): Promise<void>;
    importFile(locale: string): Promise<void>;
    openFile(locale: string): Promise<void>;
    exportFile(locale: string): Promise<void>;
    downloadTemplate(locale: string): Promise<void>;
    clear(locale: string): Promise<void>;
    onDidChange: vscode.Event<void>;
}

type PanelMessage =
    | { type: 'ready' }
    | { type: 'setLocale'; locale: string }
    | { type: 'export' }
    | { type: 'template' }
    | { type: 'clear' }
    | { type: 'save'; oldSource?: string; source: string; target: string }
    | { type: 'delete'; source: string }
    | { type: 'import' }
    | { type: 'openFile' };

let current: { panel: vscode.WebviewPanel; reset(locale: string): void } | undefined;

function labels() {
    return {
        title: vscode.l10n.t('Custom Dictionary'),
        glyph: vscode.l10n.t('Glyph'),
        export: vscode.l10n.t('Export…'),
        template: vscode.l10n.t('Download template'),
        clear: vscode.l10n.t('Clear'),
        search: vscode.l10n.t('Search'),
        import: vscode.l10n.t('Import…'),
        openFile: vscode.l10n.t('Open file'),
        from: vscode.l10n.t('From (source word, any glyph)'),
        to: vscode.l10n.t('To (replacement)'),
        add: vscode.l10n.t('Add'),
        delete: vscode.l10n.t('Delete'),
        empty: vscode.l10n.t('No entries'),
    };
}

/** 打开（或聚焦）自定义词典管理面板：展示当前转换字形的词典，可增删改、导入、打开文件。 */
export function openDictionaryPanel(backend: PanelBackend): void {
    if (current) {
        current.reset(backend.initialLocale);
        current.panel.reveal();
        return;
    }
    const panel = vscode.window.createWebviewPanel(
        'cslediagnostic.dictionary',
        vscode.l10n.t('Custom Dictionary'),
        vscode.ViewColumn.Active,
        { enableScripts: true, localResourceRoots: [] });

    const nonce = Array.from({ length: 24 }, () => Math.floor(Math.random() * 36).toString(36)).join('');
    panel.webview.html = buildPanelHtml(nonce, panel.webview.cspSource);

    let locale = backend.initialLocale;
    current = {
        panel,
        reset: initial => { locale = initial; void send(); },
    };
    const send = async (extra: { error?: string; saved?: boolean } = {}) => {
        const state = await backend.getState(locale);
        void panel.webview.postMessage({
            type: 'state', ...state, locale, locales: backend.locales, labels: labels(), ...extra });
    };

    const subscriptions: vscode.Disposable[] = [
        backend.onDidChange(() => { void send(); }),
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('cslediagnostic.customDictionaryDirectory')) {
                void send();
            }
        }),
        panel.onDidChangeViewState(e => { if (e.webviewPanel.visible) {void send();} }),
        panel.webview.onDidReceiveMessage(async (message: PanelMessage) => {
            switch (message.type) {
                case 'ready':
                    await send();
                    break;
                case 'setLocale':
                    if (backend.locales.some(l => l.value === message.locale)) {
                        locale = message.locale;
                        await send();
                    }
                    break;
                case 'save': {
                    const error = await backend.save(locale, message.oldSource, message.source, message.target);
                    if (error) {
                        void panel.webview.postMessage({ type: 'error', message: error });
                        if (message.oldSource !== undefined) {await send({ error });}
                    } else {
                        await send({ saved: message.oldSource === undefined });
                    }
                    break;
                }
                case 'delete':
                    await backend.remove(locale, message.source);
                    await send();
                    break;
                case 'import':
                    await backend.importFile(locale);
                    break;
                case 'openFile':
                    await backend.openFile(locale);
                    break;
                case 'export':
                    await backend.exportFile(locale);
                    break;
                case 'template':
                    await backend.downloadTemplate(locale);
                    break;
                case 'clear':
                    await backend.clear(locale);
                    break;
            }
        }),
    ];

    panel.onDidDispose(() => {
        current = undefined;
        subscriptions.forEach(d => d.dispose());
    });
}
