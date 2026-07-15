// Intercepts require('vscode') to return our mock, so that source modules
// which do `import * as vscode from 'vscode'` can be loaded in plain Node.
import * as path from 'path';

const Module = require('module');
const mockPath = path.resolve(__dirname, '../mock/vscode.js');
const originalResolveFilename = (Module as any)._resolveFilename;

(Module as any)._resolveFilename = function (request: string, ...args: any[]) {
    if (request === 'vscode') {
        return mockPath;
    }
    return originalResolveFilename.call(this, request, ...args);
};
