import * as vscode from 'vscode';
import { refreshDartDiagnostics } from './dart';
import { refreshJSTSDiagnostics } from './js-ts';
import { refreshPHPDiagnostics } from './php';
import { refreshPythonDiagnostics } from './python';

export function refreshDiagnostics(
    doc: vscode.TextDocument,
    collection: vscode.DiagnosticCollection
) {
    if (doc.languageId === 'dart') {
        refreshDartDiagnostics(doc, collection);
    } else if (doc.languageId === 'javascript' || doc.languageId === 'typescript') {
        refreshJSTSDiagnostics(doc, collection);
    } else if (doc.languageId === 'php') {
        refreshPHPDiagnostics(doc, collection);
    } else if (doc.languageId === 'python') {
        refreshPythonDiagnostics(doc, collection);
    }
}