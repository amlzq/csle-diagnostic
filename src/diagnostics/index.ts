import * as vscode from 'vscode';
import { refreshDartDiagnostics } from './dart';
import { refreshWebDiagnostics } from './js-ts-jsx-tsx';
import { refreshPHPDiagnostics } from './php';
import { refreshPythonDiagnostics } from './python';
import { refreshCssDiagnostics, refreshHtmlDiagnostics, refreshJsonDiagnostics } from './js-ts-jsx-tsx';

export async function refreshDiagnostics(
    doc: vscode.TextDocument,
    collection: vscode.DiagnosticCollection
): Promise<void> {
    if (doc.languageId === 'dart') {
        await refreshDartDiagnostics(doc, collection);
    } else if (doc.languageId === 'javascript' || doc.languageId === 'typescript' || doc.languageId === 'javascriptreact' || doc.languageId === 'typescriptreact') {
        refreshWebDiagnostics(doc, collection);
    } else if (doc.languageId === 'html') {
        await refreshHtmlDiagnostics(doc, collection);
    } else if (doc.languageId === 'css') {
        await refreshCssDiagnostics(doc, collection);
    } else if (doc.languageId === 'json') {
        await refreshJsonDiagnostics(doc, collection);
    } else if (doc.languageId === 'php') {
        await refreshPHPDiagnostics(doc, collection);
    } else if (doc.languageId === 'python') {
        await refreshPythonDiagnostics(doc, collection);
    }
}
