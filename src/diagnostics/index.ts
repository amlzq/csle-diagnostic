import * as vscode from 'vscode';
import { refreshDartDiagnostics } from './dart';
import { refreshWebDiagnostics } from './js-ts-jsx-tsx';
import { refreshPHPDiagnostics } from './php';
import { refreshPythonDiagnostics } from './python';

export async function refreshDiagnostics(
    doc: vscode.TextDocument,
    collection: vscode.DiagnosticCollection
): Promise<void> {
    if (doc.languageId === 'dart') {
        await refreshDartDiagnostics(doc, collection);
    } else if (doc.languageId === 'javascript' || doc.languageId === 'typescript' || doc.languageId === 'javascriptreact' || doc.languageId === 'typescriptreact') {
        refreshWebDiagnostics(doc, collection);
    } else if (doc.languageId === 'php') {
        await refreshPHPDiagnostics(doc, collection);
    } else if (doc.languageId === 'python') {
        await refreshPythonDiagnostics(doc, collection);
    }
}
