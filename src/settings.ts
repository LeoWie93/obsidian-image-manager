import { App, PluginSettingTab, Setting } from "obsidian";
import ImageManager from "./main";

export interface ImageManagerSettings {
	mySecret: string;
	sort: string;
}

export const DEFAULT_SETTINGS: ImageManagerSettings = {
	mySecret: 'default',
	sort: 'updated'
}

export class ImageManagerSettingTab extends PluginSettingTab {
	plugin: ImageManager;

	constructor(app: App, plugin: ImageManager) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName("Dropdown test")
			.addDropdown(dropDown => dropDown
				.addOptions({ "updated": "Last Changed", "alphabetic": "Alphabetic" })
				.setValue(this.plugin.settings.sort)
				.onChange(async (value) => {
					this.plugin.settings.sort = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Settings #1')
			.setDesc('It\'s a secret')
			.addText(text => text
				.setPlaceholder('Enter your secret')
				.setValue(this.plugin.settings.mySecret)
				.onChange(async (value) => {
					this.plugin.settings.mySecret = value;
					await this.plugin.saveSettings();
				}));
	}
}
