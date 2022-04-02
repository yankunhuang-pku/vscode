'use strict';

import * as vscode from 'vscode';
import { DepNodeProvider, Dependency } from './nodeDependencies';
import { globals } from './global';
import * as fs from 'fs';
import * as path from 'path';
import * as configGenerator from './ConfigGenerator';

export function activate(context: vscode.ExtensionContext) {

	// Samples of `window.registerTreeDataProvider`
	const nodeDependenciesProvider = new DepNodeProvider();
	vscode.window.registerTreeDataProvider('nodeDependencies', nodeDependenciesProvider);
	vscode.commands.registerCommand('nodeDependencies.refreshEntry', () => nodeDependenciesProvider.sync_from_file());
	vscode.commands.registerCommand('nodeDependencies.generateConfig', () => nodeDependenciesProvider.export_to_file());
	vscode.commands.registerCommand('nodeDependencies.create', () => createDefaultConfig());
	vscode.commands.registerCommand('nodeDependencies.open', async () => await openConfig());
	vscode.commands.registerCommand('nodeDependencies.keep', (node: Dependency) => nodeDependenciesProvider.markLabel(node, 'keep'));
	vscode.commands.registerCommand('nodeDependencies.redact', (node: Dependency) => nodeDependenciesProvider.markLabel(node, 'redact'));
	// vscode.commands.registerCommand('nodeDependencies.keep', (node: Dependency) => nodeDependenciesProvider.markLabel(node, '√'));
	// vscode.commands.registerCommand('nodeDependencies.redact', (node: Dependency) => nodeDependenciesProvider.markLabel(node, 'X'));
	vscode.commands.registerCommand('nodeDependencies.dateShift', (node: Dependency) => nodeDependenciesProvider.markLabel(node, 'dateShift'));
	vscode.commands.registerCommand('nodeDependencies.cryptoHash', (node: Dependency) => nodeDependenciesProvider.markLabel(node, 'cryptoHash'));
	vscode.commands.registerCommand('nodeDependencies.encrypt', (node: Dependency) => nodeDependenciesProvider.markLabel(node, 'encrypt'));
	vscode.commands.registerCommand('nodeDependencies.reset', (node: Dependency) => nodeDependenciesProvider.markLabel(node, ''));

	async function openConfig() {
		const filepath = await vscode.window.showOpenDialog({});
		if (!filepath) {
			return undefined;
		} else {
			await vscode.window.showTextDocument(filepath[0]);
			globals.filepath = filepath[0].fsPath;
			nodeDependenciesProvider.sync_from_file();
		}
	}

	async function createDefaultConfig() {
		const filepath = await vscode.window.showSaveDialog({filters: {'Json': ['json']}});
		if (!filepath) {
			return undefined;
		} else {
			nodeDependenciesProvider.createDefaultConfig();
			configGenerator.saveConfig(globals.treeDataJson, filepath.fsPath);
			await vscode.window.showTextDocument(filepath);
			globals.filepath = filepath.fsPath;
			nodeDependenciesProvider.sync_from_file()
		}
	}

	function writeJsonToFile(filePath: string, msg: object) {
		const flag = checkCreateFolders(path.dirname(filePath));
		fs.writeFileSync(filePath, JSON.stringify(msg, null, 4));
		return flag;
	}

	function checkCreateFolders(resultFolder: string) {
		if (!fs.existsSync(resultFolder)) {
			fs.mkdirSync(resultFolder, { recursive: true });
			return false;
		}
		return true;
	}
}