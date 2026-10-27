import * as vscode from 'vscode';
import { scanDocument } from '../scan/scanDocument';
import { toLabel } from '../utils/utils';

export async function refreshDiagnostics(
    doc: vscode.TextDocument,
    collection: vscode.DiagnosticCollection
): Promise<void> {
    const docVersion = doc.version;
    const result = await scanDocument(doc);
    if (!result) {return;}

    const message = vscode.l10n.t('Contains {0} (expected {1})', toLabel(result.from), toLabel(result.to));
    const diagnostics = result.findings.map(({ range }) => {
        const diagnostic = new vscode.Diagnostic(range, message, vscode.DiagnosticSeverity.Warning);
        diagnostic.code = 'csle-convert';
        return diagnostic;
    });

    if (doc.version === docVersion) {
        collection.set(doc.uri, diagnostics);
    }
}
