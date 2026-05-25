import { readFile, writeFile } from 'node:fs/promises';
import nodePath from 'node:path';
import * as v from 'valibot';
import { options, output_path } from '../state.js';

const parsePackageJson = v.parser(
	v.pipe(
		v.string(),
		v.parseJson(),
		v.object({
			version: v.string(),
			dependencies: v.record(v.string(), v.string()),
			optionalDependencies: v.record(v.string(), v.string()),
			devDependencies: v.record(v.string(), v.string()),
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
		v.check(
			(value) => value.allDependencies['type-fest'] !== undefined,
			'Missing type-fest dependency',
		),
		v.check(
			(value) => value.allDependencies.valibot !== undefined,
			'Missing valibot dependency',
		),
		v.check(
			(value) => value.allDependencies['@kirick/tasq'] !== undefined,
			'Missing @kirick/tasq dependency',
		),
	),
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
					'type-fest': data.allDependencies['type-fest'],
					valibot: data.allDependencies.valibot,
				},
				peerDependencies: {
					'@kirick/tasq': data.allDependencies['@kirick/tasq'],
				},
			},
			null,
			'\t',
		),
		'utf8',
	);
}
