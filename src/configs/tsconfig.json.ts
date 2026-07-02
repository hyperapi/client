import { readFile, writeFile } from 'node:fs/promises';
import nodePath from 'node:path';
import { output_path } from '../state.js';

/** Creates tsconfig.json for the client library. */
export async function createTsconfigJson(): Promise<void> {
	const content = await readFile(
		nodePath.join(import.meta.dirname, '../../tsconfig.json'),
		'utf8',
	);

	const tsconfig = JSON.parse(content);
	tsconfig.compilerOptions.isolatedDeclarations = false;

	await writeFile(
		nodePath.join(output_path, 'tsconfig.json'),
		JSON.stringify(tsconfig, null, '\t'),
		'utf8',
	);
}
