import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { globals } from './global';
import * as configGenerator from './ConfigGenerator';

export class DepNodeProvider implements vscode.TreeDataProvider<Dependency> {

	public _onDidChangeTreeData: vscode.EventEmitter<Dependency | undefined | void> = new vscode.EventEmitter<Dependency | undefined | void>();
	readonly onDidChangeTreeData: vscode.Event<Dependency | undefined | void> = this._onDidChangeTreeData.event;


	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	sync_from_file(): void {
		if (globals.filepath) {
			globals.treeDataJson = configGenerator.loadConfig(globals.filepath);
		}
		this._onDidChangeTreeData.fire();
	}

	async export_to_file(): Promise<void> {
		if (globals.filepath) {
			configGenerator.saveConfig(globals.treeDataJson, globals.filepath);
			await vscode.window.showTextDocument(vscode.Uri.file(globals.filepath));
		}
	}

	createDefaultConfig() {
		globals.treeDataJson = configGenerator.createDefaultConfig();
		return globals.treeDataJson;
	}

	getTreeItem(element: Dependency): vscode.TreeItem {
		return element;
	}

	getChildren(element?: Dependency): Thenable<Dependency[]> {
		if (!globals.filepath) {
			vscode.window.showInformationMessage('No config files found. Please select an action from Explorer.');
			return Promise.resolve([]);
		}

		if (element) {
			return Promise.resolve(this.getResources(element.id));
		} else {
			return Promise.resolve(this.getResources(undefined));
		}

	}

	markLabel(node: Dependency, method: string) {
		this.updateDataUsingId(node.id, method);
		this.refresh();
	}

	

	random() {
		return Math.floor(Math.random()*100);
	}

	private updateDataUsingId(id: string, method: string) {
		const prop_list = id.split('_');
		var data = globals.treeDataJson;
		for(var i = 0; i < prop_list.length; i++) {
			if ( i < prop_list.length - 1) {
				data = data[prop_list[i]]["children"];
			} else {
				data = data[prop_list[i]]
			}
		}
		data["method"] = method;
		this.updateChildren(data, method);
		// var number = this.random() + "%";
		// data["method"] = number;
		// number = this.random() + "%";
		// this.updateChildren(data, number);
	}

	private updateChildren(data, method){
		var children = Object.keys(data["children"]);
		if(children.length > 0) {
			for(var i = 0; i < children.length; i++) {
				data["children"][children[i]]["method"] = method;
				this.updateChildren(data["children"][children[i]], method);
				// var number = this.random() + "%";
				// data["children"][children[i]]["method"] = number;
				// number = this.random() + "%";
				// this.updateChildren(data["children"][children[i]], number);
			}
		}
	}

	private extractChildrenUsingId(id: string) {
		const prop_list = id.split('_');
		var data = globals.treeDataJson;
		for(var prop of prop_list) {
			data = data[prop]["children"];
		}
		return data;
	}
	/**
	 * Given the path to package.json, read all its dependencies and devDependencies.
	 */
	private getResources(id: string | undefined): Dependency[] {
		const createNewObject = (label: string, id: string, method: string): Dependency => {
			var child = this.extractChildrenUsingId(id);
			if (child.length != 0) {
				return new Dependency(label, id, method, vscode.TreeItemCollapsibleState.Collapsed);
			} else {
				return new Dependency(label, id, method, vscode.TreeItemCollapsibleState.None);
			}
		};
			
		if (id == undefined) {
			const res = globals.treeDataJson
				? Object.keys(globals.treeDataJson).map(prop => createNewObject(prop, prop, globals.treeDataJson[prop]["method"]))
				: [];
			return res;
		} else {
			var data = this.extractChildrenUsingId(id);
			const res = data
				? Object.keys(data).map(prop => createNewObject(prop, id + '_' + prop, data[prop]["method"]))
				: [];
			return res;
		}
	}

	private load_default_schema() {
		return {
			Patient: {
				method: "keep",
				children: {
					id: { 
						method: "keep",
						children: {}
					},
					name: { 
						method: "",
						children: {}
					},
					id2: { 
						method: "keep",
						children: {}
					},
					name2: { 
						method: "dateShift",
						children: {}
					},
					id3: { 
						method: "keep",
						children: {}
					},
					name4: { 
						method: "redact",
						children: {}
					},
				}
			},
			Condition: {
				method: "keep",
				children: {
					id: { 
						method: "keep",
						children: {}
					},
				}
			}
		};
	}

	private load_from_file(filepath: string) {
		return {
			Patient: {
				method: "keep",
				children: {
					id: { 
						method: "keep",
						children: {}
					},
					name: { 
						method: "",
						children: {}
					},
					id2: { 
						method: "keep",
						children: {}
					},
					name2: { 
						method: "dateShift",
						children: {}
					},
					id3: { 
						method: "keep",
						children: {}
					},
					name4: { 
						method: "redact",
						children: {}
					},
				}
			}
		};
	}
	

	// private getResfromJson(): Dependency[] {
	// 	const data = this.load_default_schema();

	// 	const toDep = (prop: string, method: string): Dependency => {
	// 			return new Dependency(prop, method, vscode.TreeItemCollapsibleState.Collapsed);
	// 		}
	// 	};

	// 		const res = data
	// 			? Object.keys(packageJson.dependencies).map(dep => toDep(dep, packageJson.dependencies[dep]))
	// 			: [];
	// 	return res;
		
	// }

	private pathExists(p: string): boolean {
		try {
			fs.accessSync(p);
		} catch (err) {
			return false;
		}

		return true;
	}
}

export class Dependency extends vscode.TreeItem {

	constructor(
		public label: string,
		public id: string,
		private method: string,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState,
		public readonly command?: vscode.Command
	) {
		super(label, collapsibleState);
	}

	// @ts-ignore
	get tooltip(): string {
		return `${this.label}: ${this.method}`;
	}

	// @ts-ignore
	get description(): string {
		return this.method;
	}

	iconPath = {
		light: path.join(__filename, '..', '..', 'resources', 'light', 'dependency.svg'),
		dark: path.join(__filename, '..', '..', 'resources', 'dark', 'dependency.svg')
	};

	contextValue = 'dependency';

}
