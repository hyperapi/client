import { copyFile } from 'node:fs/promises';
import nodePath from 'node:path';
import { output_path } from './state.js';

/**
 * Root of this package, for reaching files that ship beside the code —
 * `template/` and our own `package.json`.
 *
 * This module has to stay at the top level of `src/` for that to hold: there it
 * is one level below the root when run from source, and so is the built
 * `dist/`, whether the build is unbundled or collapsed into a single file.
 * Modules deeper in the tree import this instead of counting `..` themselves,
 * which would only be right for one of those layouts.
 */
export const PACKAGE_ROOT = nodePath.join(import.meta.dirname, '..');

/**
 * Copies the template file to the target path.
 * @param path The target path to copy the template file to.
 */
export async function copyTemplateFile(...path: string[]): Promise<void> {
	await copyFile(
		nodePath.join(PACKAGE_ROOT, 'template', ...path),
		nodePath.join(output_path, ...path),
	);
}
