import * as vscode from 'vscode';
import { buildPanelHtml } from './dictionaryPanelHtml';

export interface PanelState {
    glyph: string;
    file: string;
    entries: Array<[string, string]>;
}

export interface PanelBackend {
    getState(): Promise<PanelState>;
    /** 保存词条，`oldSource` 存在且不同于 `source` 时视为改名；返回错误信息（成功则 undefined）。 */
    save(oldSource: string | undefined, source: string, target: string): Promise<string | undefined>;
    remove(source: string): Promise<void>;
    importFile(): Promise<void>;
    openFile(): Promise<void>;
    onDidChange: vscode.Event<void>;
}

type PanelMessage =
    | { type: 'ready' }
    | { type: 'save'; oldSource?: string; source: string; target: string }
    | { type: 'delete'; source: string }
    | { type: 'import' }
    | { type: 'openFile' };

let current: vscode.WebviewPanel | undefined;

function labels(glyph: string) {
    return {
        title: vscode.l10n.t('Custom Dictionary'),
        glyph: vscode.l10n.t('Convert Glyph: {0}', glyph),
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
        current.reveal();
        return;
    }
    const panel = vscode.window.createWebviewPanel(
        'cslediagnostic.dictionary',
        vscode.l10n.t('Custom Dictionary'),
        vscode.ViewColumn.Active,
        { enableScripts: true, localResourceRoots: [] });
    current = panel;

    const nonce = Array.from({ length: 24 }, () => Math.floor(Math.random() * 36).toString(36)).join('');
    panel.webview.html = buildPanelHtml(nonce, panel.webview.cspSource);

    const send = async (extra: { error?: string; saved?: boolean } = {}) => {
        const state = await backend.getState();
        void panel.webview.postMessage({ type: 'state', ...state, labels: labels(state.glyph), ...extra });
    };

    const subscriptions: vscode.Disposable[] = [
        backend.onDidChange(() => { void send(); }),
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('cslediagnostic.convertGlyph') ||
                e.affectsConfiguration('cslediagnostic.customDictionaryDirectory')) {
                void send();
            }
        }),
        panel.onDidChangeViewState(e => { if (e.webviewPanel.visible) {void send();} }),
        panel.webview.onDidReceiveMessage(async (message: PanelMessage) => {
            switch (message.type) {
                case 'ready':
                    await send();
                    break;
                case 'save': {
                    const error = await backend.save(message.oldSource, message.source, message.target);
                    if (error) {
                        void panel.webview.postMessage({ type: 'error', message: error });
                        if (message.oldSource !== undefined) {await send({ error });}
                    } else {
                        await send({ saved: message.oldSource === undefined });
                    }
                    break;
                }
                case 'delete':
                    await backend.remove(message.source);
                    await send();
                    break;
                case 'import':
                    await backend.importFile();
                    break;
                case 'openFile':
                    await backend.openFile();
                    break;
            }
        }),
    ];

    panel.onDidDispose(() => {
        current = undefined;
        subscriptions.forEach(d => d.dispose());
    });
}
