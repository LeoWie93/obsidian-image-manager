import { App, TFile } from "obsidian";

const imageLinkRegex = /\[\[([^\|\]]+\.(?:png|jpg|jpeg))(?:[^\]]*)?\]\]/g;
//TODO also handle svg's and more files. Could this be a problem?
export const supportedFileExtensions: string[] = ["png", "jpg", "jpeg"];

export async function getLinkedImages(file: TFile, app: App): Promise<string[]> {
	const fileNames: string[] = [];
	const content: string = await app.vault.cachedRead(file);

	const matches = content.matchAll(imageLinkRegex);
	for (const match of matches) {
		if (match[1]) {
			fileNames.push(match[1]);
		}
	}

	return fileNames;
}

