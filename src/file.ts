import { copyFile } from 'node:fs/promises';
import nodePath from 'node:path';
import { output_path } from './state.js';

/**
 * Copies the template file to the target path.
 * @param path The target path to copy the template file to.
 */
export async function copyTemplateFile(...path: string[]): Promise<void> {
	await copyFile(
		nodePath.join(import.meta.dirname, '..', 'template', ...path),
		nodePath.join(output_path, ...path),
	);
}
