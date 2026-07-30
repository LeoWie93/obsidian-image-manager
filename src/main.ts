import { App, Modal, Notice, Plugin, TAbstractFile, TFile } from 'obsidian';
import { DEFAULT_SETTINGS, ImageManagerSettings, ImageManagerSettingTab } from "./settings";
import { supportedImageExtensions, getLinkedImages, supportedTextfileExtensions } from 'lib/FileParser';
import { isDocument, isImage } from 'lib/Helpers';
import { VaultState } from 'lib/VaultState';
import { SyncTaskQueue } from 'lib/Queue/SyncTaskQueue';
import { AddImage, RemoveDocument, RemoveImage, RenameImage, UpdateImageRelations } from 'lib/Queue/Tasks';
import * as logger from 'lib/Logger';


//Obsidian does not make this field public on its own.
declare module "obsidian" {
	interface TFile {
		deleted: boolean;
	}
}

export default class ImageManager extends Plugin {
	syncQueue: SyncTaskQueue = new SyncTaskQueue();
	settings: ImageManagerSettings;
	vaultState: VaultState;

	async onload() {
		await this.loadSettings();
		logger.setLoglevel(this.settings.logLevel);

		this.app.workspace.onLayoutReady(async () => {
			//PERFORMANCE logging
			let startTime: number | null = null;
			if (this.settings.performanceTrackingEnabled) {
				startTime = performance.now();
			}

			const files: TFile[] = this.app.vault.getFiles();

			const physicalImages: Map<string, TFile> = new Map<string, TFile>;
			files.forEach((file: TFile) => {
				if (supportedImageExtensions.includes(file.extension)) {
					physicalImages.set(file.name, file);
				}
			});
			this.vaultState = new VaultState(physicalImages);

			const documentFiles: TFile[] = files.filter((file: TFile) => {
				return (supportedTextfileExtensions.includes(file.extension) && !file.deleted);
			});

			await Promise.all(
				documentFiles.map(async (file: TFile) => {
					const linkedImages: string[] = await getLinkedImages(file, this.app);
					linkedImages.forEach((imageName) => {
						this.syncQueue.enqueue(
							new UpdateImageRelations(imageName, file, this.vaultState)
						);
					});
				})
			);

			if (this.settings.performanceTrackingEnabled && startTime) {
				performance.measure("Parsing complete", {
					start: startTime,
					end: performance.now(),
					detail: {
						devtools: {
							dataType: "track-entry",
							track: "File Parsing",
							trackGroup: "Image Manager",
							color: "tertiary-dark",
							properties: [
								["Filter Type", "Gaussian Blur"],
							],
							tooltipText: "Files parsed succesfully",
						}
					}
				});
			}

			logger.debug("Image Relations", this.vaultState.imageRelations);
			logger.debug("Physical Images", this.vaultState.physicalImages);
			logger.debug("Dangling Images", this.vaultState.getDanglingImages());


			this.registerEvent(
				this.app.vault.on('create', async (file: TAbstractFile) => {
					logger.debug("Create handler", { message: "entered" });
					logger.debug("Created file", file);

					if (file instanceof TFile) {
						if (isDocument(file)) {
							const linkedImages: string[] = await getLinkedImages(file, this.app);
							linkedImages.forEach((imageName) => {
								this.syncQueue.enqueue(
									new UpdateImageRelations(imageName, file, this.vaultState)
								);
							});
						} else if (isImage(file)) {
							this.syncQueue.enqueue(new AddImage(file, this.vaultState));
						}
					}
				})
			);

			this.registerEvent(
				this.app.vault.on('modify', async (file: TAbstractFile) => {
					logger.debug("Modify handler", { message: "entered" });
					logger.debug("Modified file", file);

					if (file instanceof TFile && isDocument(file)) {
						const linkedImages: string[] = await getLinkedImages(file, this.app);
						linkedImages.forEach((imageName) => {
							this.syncQueue.enqueue(
								new UpdateImageRelations(imageName, file, this.vaultState)
							);
						});
					}
				})
			);

			this.registerEvent(
				this.app.vault.on('rename', (newFile: TAbstractFile, oldPath: string) => {
					logger.debug("Rename handler", { message: "entered" });
					logger.debug("New file", newFile);
					logger.debug("Oldpath", { message: oldPath });

					if (newFile instanceof TFile) {
						if (isImage(newFile)) {
							this.syncQueue.enqueue(new RenameImage(oldPath, newFile, this.vaultState));
						}
						//Files do not need to be handled. We have the TFile reference directly in our map, which is updated by obsidian
					}
				})
			);

			this.registerEvent(
				this.app.vault.on('delete', (file: TAbstractFile) => {
					logger.debug("Delete handler", { message: "entered" });
					logger.debug("Deleted file", file);

					if (file instanceof TFile) {
						if (isDocument(file)) {
							this.syncQueue.enqueue(new RemoveDocument(file, this.vaultState));
						} else if (isImage(file)) {
							this.syncQueue.enqueue(new RemoveImage(file, this.vaultState));
						}
					}
				})
			);
		});

		this.addCommand({
			id: 'image-cleanup',
			name: 'Open UI',
			callback: () => {
				new ManageModal(this.app, this.vaultState, this.syncQueue).open();
			}
		});

		this.addSettingTab(new ImageManagerSettingTab(this.app, this));
	}

	onunload() {
		//we have nothing to cleanup on disk etc.
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<ImageManagerSettings>);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class ManageModal extends Modal {
	vaultState: VaultState;
	syncQueue: SyncTaskQueue;
	entryContainer: HTMLDivElement;

	constructor(app: App, vaultState: VaultState, syncQueue: SyncTaskQueue) {
		super(app);
		this.vaultState = vaultState;
		this.syncQueue = syncQueue;
	}

	async onOpen() {
		const { contentEl } = this;

		const modal: Element | null = this.containerEl.querySelector("div.modal");
		if (modal instanceof HTMLElement) {
			modal.classList.add("width_100");
		}

		const modalTitle: HTMLHeadingElement = document.createEl("h1");
		modalTitle.setText("Image manager");
		contentEl.appendChild(modalTitle);

		if (!this.syncQueue.isEmpty()) {
			const loadingContainer: HTMLDivElement = document.createEl("div");
			loadingContainer.classList.add("image-manager-loader-div");

			const loadingText: HTMLHeadingElement = document.createEl("h2");
			loadingText.setText("Indexing in process");

			const loaderAnimation: HTMLSpanElement = document.createEl("span");
			loaderAnimation.classList.add("image-manager-loader-animation");
			loadingText.appendChild(loaderAnimation);

			loadingContainer.appendChild(loadingText);
			contentEl.appendChild(loadingContainer);

			await this.syncQueue.waitForEmpty();
			loadingContainer.remove();
		}

		this.buildModalContent();
	}

	buildModalContent() {
		const { contentEl } = this;

		this.entryContainer = document.createEl("div");
		this.entryContainer.classList.add("entry-grid-container");
		contentEl.appendChild(this.entryContainer);

		const danglingImages = this.vaultState.getDanglingImages();

		console.debug("dangling images lenght", danglingImages.length);

		if (danglingImages.length <= 0) {
			console.debug("no dangling images");
			const emptyInfo: HTMLHeadingElement = document.createEl("h2");
			emptyInfo.setText("The vault currently does not contain dangling images.");
			contentEl.appendChild(emptyInfo);

			return;
		}

		const fragment: DocumentFragment = document.createDocumentFragment();

		danglingImages.forEach((file: TFile) => {
			console.debug("file iteration");
			const entryCard = document.createEl("div");
			entryCard.classList.add("entry-card");
			entryCard.dataset.filePath = file.path;

			const name = document.createEl("h3");
			name.setText(file.basename);

			const filePath = document.createEl("p");
			filePath.setText(file.path);

			const deleteButton = document.createEl("button");
			deleteButton.type = "button";
			deleteButton.classList.add("delete-image-button");
			deleteButton.setText("Delete image");

			const openButton = document.createEl("button");
			openButton.type = "button";
			openButton.classList.add("open-image-button");
			openButton.setText("Open image");

			const buttonGroup = document.createEl("div");
			buttonGroup.classList.add("button-group");
			buttonGroup.appendChild(openButton);
			buttonGroup.appendChild(deleteButton);

			// Preview Image
			const resourcePath = this.app.vault.getResourcePath(file);
			const previewImage = document.createEl("img");
			previewImage.src = resourcePath;

			entryCard.appendChild(name);
			entryCard.appendChild(filePath);
			entryCard.appendChild(previewImage);
			entryCard.appendChild(buttonGroup);
			fragment.append(entryCard);
		});

		this.entryContainer.appendChild(fragment);

		this.entryContainer.addEventListener("click", this.handleGridContainerClick);
	}

	handleGridContainerClick = (event: MouseEvent): void => {
		const target: EventTarget | null = event.target;
		if (!(target instanceof HTMLElement)) {
			return;
		}

		const openButton: Element | null = target.closest('.open-image-button');
		const deleteButton: Element | null = target.closest('.delete-image-button');

		if (!openButton && !deleteButton) {
			logger.debug("grid-container", { message: "No button clicked" });
			return;
		}

		const entryCard = target.closest('.entry-card');
		if (!(entryCard instanceof HTMLDivElement)) {
			new Notice("Entry card of the clicked button not found. Please create a bug report.");
			return;
		}

		const file: TFile | null = this.app.vault.getFileByPath(entryCard.dataset.filePath ?? '');

		if (!file) {
			new Notice("File to use for the clicked action was not found. Please restart Obsidian or create an bug report if the issue persists.");
			return;
		}

		if (openButton && openButton.instanceOf(HTMLButtonElement)) {
			openButton.disabled = true;
			logger.debug("grid-container", { message: "clicked open button" });
			void this.app.workspace.getLeaf().openFile(file).then(() => this.close());
		}

		if (deleteButton && deleteButton.instanceOf(HTMLButtonElement)) {
			deleteButton.disabled = true;
			logger.debug("grid-container", { message: "clicked delete button" });

			void this.app.fileManager.promptForDeletion(file).then(() => {
				if (file.deleted) {
					this.entryContainer.removeChild(entryCard);
					logger.debug("grid-container", { message: "User approved removal." });
					new Notice("File with name {" + file.name + "} deleted.");

					if (this.entryContainer.children.length === 0) {
						const emptyInfo = document.createEl("h2");
						emptyInfo.setText("All cleaned up");
						this.contentEl.appendChild(emptyInfo);
					}
				} else {
					deleteButton.disabled = false;
					logger.debug("delete-button", { message: "User denied removal." });
				}
			});
		}
	}

	onClose() {
		if (this.entryContainer) {
			this.entryContainer.removeEventListener("click", this.handleGridContainerClick);
		}

		const { contentEl } = this;
		contentEl.empty();
	}
}

