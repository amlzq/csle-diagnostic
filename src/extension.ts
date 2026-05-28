// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { refreshDiagnostics } from './diagnostics';
import { CsleCodeActionProvider } from './quickfix/codeActionProvider';
import { prewarmTreeSitterRuntime } from './utils/stringExtractor';

const languages = ['dart', 'javascript', 'typescript', 'javascriptreact', 'typescriptreact', 'html', 'css', 'php', 'python'];

export function activate(context: vscode.ExtensionContext) {
    const diagnosticCollection = vscode.languages.createDiagnosticCollection('cslediagnostic');
    context.subscriptions.push(diagnosticCollection);

    const perDocState = new Map<string, { running: boolean; requestedVersion: number; doc: vscode.TextDocument }>();

    function requestDiagnostics(doc: vscode.TextDocument) {
        if (!languages.includes(doc.languageId)) return;

        const key = doc.uri.toString();
        const existing = perDocState.get(key);
        const state = existing ?? { running: false, requestedVersion: doc.version, doc };
        state.requestedVersion = doc.version;
        state.doc = doc;
        perDocState.set(key, state);

        if (state.running) return;

        void (async () => {
            state.running = true;
            try {
                while (true) {
                    const version = state.requestedVersion;
                    const currentDoc = state.doc;
                    await refreshDiagnostics(currentDoc, diagnosticCollection);
                    if (state.requestedVersion === version) break;
                }
            } finally {
                state.running = false;
            }
        })();
    }

    context.subscriptions.push(
        vscode.workspace.onDidOpenTextDocument(requestDiagnostics),
        vscode.workspace.onDidChangeTextDocument(e => requestDiagnostics(e.document)),
        vscode.workspace.onDidChangeConfiguration(() => {
            vscode.workspace.textDocuments.forEach(requestDiagnostics);
        }),
        vscode.workspace.onDidCloseTextDocument(doc => {
            perDocState.delete(doc.uri.toString());
            diagnosticCollection.delete(doc.uri);
        })
    );

    context.subscriptions.push(
        vscode.languages.registerCodeActionsProvider(
            languages,
            new CsleCodeActionProvider(),
            { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] }
        )
    );

    setTimeout(() => {
        void prewarmTreeSitterRuntime();
    }, 0);

    vscode.workspace.textDocuments.forEach(requestDiagnostics);
}

export function deactivate() { }
