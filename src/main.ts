import { App, Editor, FileManager, MarkdownView, Modal, Notice, Plugin, TAbstractFile, TFile, TFolder } from 'obsidian';
import { DEFAULT_SETTINGS, ImageManagerSettings, ImageManagerSettingTab } from "./settings";

// Remember to rename these classes and interfaces!
export default class ImageManager extends Plugin {
	settings: ImageManagerSettings;
	knownImages: [];
	knownLinks: [];

	async onload() {
		await this.loadSettings();


		this.app.workspace.onLayoutReady(() => {
			const files: TFile[] = this.app.vault.getFiles();
			// filter all files for images
			// filter all files for .md and canvas files (bases aswell?)

			// files.forEach(function(file: TFile) {
			// 	if (file.extension === "png") {
			// 		console.log(file.name);
			// 	}
			// });

			const abstractFile: TAbstractFile | null = this.app.vault.getAbstractFileByPath(files[0]?.path ?? "");
			console.log(abstractFile);

			if (files[0]) {
				this.app.fileManager.trashFile(files[0]);
			}
		});


		// load images with information
		// load via own FS calls or use obsidian api?

		//TODO parse vault and set knownImages and knownLinks
		//TODO register create,change,delete events and listen for images to update state

		// this.addRibbonIcon('dice', 'Sample', (evt: MouseEvent) => {
		// 	new Notice('This is a notice!');
		// });

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		// const statusBarItemEl = this.addStatusBarItem();
		// statusBarItemEl.setText('Status bar text');

		// This adds a simple command that can be triggered anywhere
		// this.addCommand({
		// 	id: 'open-modal-simple',
		// 	name: 'Open modal (simple)',
		// 	callback: () => {
		// 		new SampleModal(this.app).open();
		// 	}
		// });

		// This adds an editor command that can perform some operation on the current editor instance
		// this.addCommand({
		// 	id: 'replace-selected',
		// 	name: 'Replace selected content',
		// 	editorCallback: (editor: Editor, view: MarkdownView) => {
		// 		editor.replaceSelection('Sample editor command');
		// 	}
		// });

		// This adds a complex command that can check whether the current state of the app allows execution of the command
		this.addCommand({
			id: 'image-cleanup',
			name: 'Image Cleanup',
			callback: () => {
				new SampleModal(this.app).open();
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new ImageManagerSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		// this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
		// 	new Notice("Click");
		// });

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		// this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));

	}

	onunload() {
		//TODO does this app need cleanup steps?
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<ImageManagerSettings>);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		let { contentEl } = this;

		const modalTitle: HTMLHeadingElement = document.createElement("h1");
		modalTitle.setText("Image Manager");
		contentEl.appendChild(modalTitle);


		// use knownLinks and knownImages to show dangling images


		const modalEntries = document.createElement("div");
		const modalEntry = document.createElement("div");
		modalEntry.setText("This is entry");

		modalEntries.appendChild(modalEntry);

		contentEl.appendChild(modalEntries);
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
