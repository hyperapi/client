import { readFile, writeFile } from 'node:fs/promises';
import nodePath from 'node:path';
import * as v from 'valibot';
import { PACKAGE_ROOT } from '../file.js';
import { options, output_path } from '../state.js';

const dependenciesSchema = v.optional(v.record(v.string(), v.string()), () => {
	return {};
});
const parsePackageJson = v.parser(
	v.pipe(
		v.string(),
		v.parseJson(),
		v.object({
			version: v.string(),
			dependencies: dependenciesSchema,
			optionalDependencies: dependenciesSchema,
			devDependencies: dependenciesSchema,
		}),
		v.transform((value) => {
			return {
				version: value.version,
				allDependencies: {
					...value.dependencies,
					...value.optionalDependencies,
					...value.devDependencies,
				},
			};
		}),
		v.check(
			(value) => value.allDependencies['@hyperapi/core'] !== undefined,
			'Missing @hyperapi/core dependency',
		),
	),
);

// Our own package.json, for dependency versions to fall back on.
const PACKAGE_JSON = parsePackageJson(
	await readFile(nodePath.join(PACKAGE_ROOT, 'package.json'), 'utf8'),
);

/** Creates package.json for the client library. */
export async function createPackageJson(): Promise<void> {
	const content = await readFile(
		nodePath.join(process.cwd(), 'package.json'),
		'utf8',
	);

	const data = parsePackageJson(content);

	await writeFile(
		nodePath.join(output_path, 'package.json'),
		JSON.stringify(
			{
				name: options.name,
				version: data.version,
				type: 'module',
				main: 'dist/main.mjs',
				types: 'dist/main.d.mts',
				files: ['dist/'],
				exports: {
					'.': {
						types: {
							import: './dist/main.d.mts',
							require: './dist/main.d.cts',
						},
						import: './dist/main.mjs',
						require: './dist/main.cjs',
					},
				},
				dependencies: {
					'@hyperapi/core': data.allDependencies['@hyperapi/core'],
					'type-fest':
						data.allDependencies['type-fest']
						?? PACKAGE_JSON.allDependencies['type-fest'],
					valibot:
						data.allDependencies.valibot
						?? PACKAGE_JSON.allDependencies.valibot,
				},
				// Only what building the client needs: its platform types come
				// from the DOM lib, so there is no `@types/*` to install.
				devDependencies: {
					typescript:
						data.allDependencies.typescript
						?? PACKAGE_JSON.allDependencies.typescript,
				},
				peerDependencies: {
					'@kirick/tasq':
						data.allDependencies['@kirick/tasq']
						?? PACKAGE_JSON.allDependencies['@kirick/tasq'],
				},
			},
			null,
			'\t',
		),
		'utf8',
	);
}
