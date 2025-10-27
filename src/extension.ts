// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { refreshDiagnostics } from './diagnostics';
import { CsleCodeActionProvider } from './quickfix/codeActionProvider';

const languages = ['dart', 'javascript', 'typescript', 'php', 'python', 'javascriptreact', 'typescriptreact'];

export function activate(context: vscode.ExtensionContext) {
    const diagnosticCollection = vscode.languages.createDiagnosticCollection('cslediagnostic');
    context.subscriptions.push(diagnosticCollection);

    function trigger(doc: vscode.TextDocument) {
        if (languages.includes(doc.languageId)) {
            refreshDiagnostics(doc, diagnosticCollection);
        }
    }

    context.subscriptions.push(
        vscode.workspace.onDidOpenTextDocument(trigger),
        vscode.workspace.onDidChangeTextDocument(e => trigger(e.document)),
        vscode.workspace.onDidChangeConfiguration(() => {
            vscode.workspace.textDocuments.forEach(trigger);
        })
    );

    context.subscriptions.push(
        vscode.languages.registerCodeActionsProvider(
            languages,
            new CsleCodeActionProvider(),
            { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] }
        )
    );

    vscode.workspace.textDocuments.forEach(trigger);
}

export function deactivate() { }
