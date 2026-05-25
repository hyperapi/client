#!/usr/bin/env node

// oxlint-disable max-lines-per-function
// oxlint-disable max-statements
// oxlint-disable no-await-in-loop
// oxlint-disable unicorn/no-process-exit

import { mkdirSync, readFileSync, rmdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';
import { getRoutes, type HyperAPIMethod } from '@hyperapi/core/dev';
import * as tsdown from 'tsdown';
import { createPackageJson } from './configs/package.json.js';
import { createTsconfigJson } from './configs/tsconfig.json.js';
import { scanExports } from './exports.js';
import { copyTemplateFile } from './file.js';
import { options, output_path, output_src_path, source_path } from './state.js';

/**
 *　Returns an array of key/values of the enumerable own properties of an object
 * @param o Object that contains the properties and methods. This can be an object that you created or an existing Document Object Model (DOM) object.
 * @returns
 */
function objectEntries<T extends Record<PropertyKey, unknown>>(
	o: T,
): [keyof T, T[keyof T]][] {
	return Object.entries(o) as [keyof T, T[keyof T]][];
}

/**
 * Returns the function name for a given HTTP method.
 * @param method - The HTTP method to get the function name for.
 * @returns The function name for the given HTTP method.
 */
function getFunctionName(method: HyperAPIMethod): string {
	return method === 'UNDEF' ? 'query' : method.toLowerCase();
}

const import_lines: string[] = [];
const overloads: Record<HyperAPIMethod, string[]> = {
	GET: [],
	OPTIONS: [],
	POST: [],
	PUT: [],
	PATCH: [],
	DELETE: [],
	UNDEF: [],
};

for (const [index, route] of getRoutes(source_path).entries()) {
	// console.log('----------');
	// console.log('route:', route);

	const exports = scanExports(route.file_path);
	// console.log('exports:', exports);

	if (exports.argsSchema === undefined) {
		throw new Error(`No exported argsSchema found in ${route.file_path}.`);
	} else if (exports.argsSchema.is_type) {
		throw new Error(
			`Exported argsSchema is not a value in ${route.file_path}.`,
		);
	}

	if (exports.default === undefined) {
		throw new Error(`No default export found in ${route.file_path}.`);
	} else if (exports.default.is_type) {
		throw new Error(`Exported default is not a value in ${route.file_path}.`);
	}

	if (exports.ResponseType && !exports.ResponseType.is_type) {
		throw new Error(
			`Exported ResponseType is not a type in ${route.file_path}.`,
		);
	}

	const has_response_type = exports.ResponseType !== undefined;

	// imports
	{
		const import_path = nodePath.relative(
			output_src_path,
			nodePath.join(process.cwd(), route.file_path),
		);
		// console.log('import path =', import_path);

		const imports = [`argsSchema as argsSchema${index}`];
		if (has_response_type) {
			imports.push(`ResponseType as ResponseType${index}`);
		} else {
			imports.push(`default as module${index}`);
		}

		import_lines.push(
			`import type { ${imports.join(', ')} } from '${import_path}';`,
		);
	}

	// overloads
	{
		const type_params = has_response_type
			? `<const A extends v.InferInput<typeof argsSchema${index}>>`
			: '';
		const type_args = has_response_type
			? 'A'
			: `v.InferInput<typeof argsSchema${index}>`;
		const type_return = has_response_type
			? `ResponseType${index}<A>`
			: `ExtractModuleResponse<typeof module${index}>`;

		overloads[route.method].push(
			`${getFunctionName(route.method)}${type_params}(route: '${route.route}', args: ${type_args}): Promise<Simplify<${type_return}>>;`,
		);
	}

	// console.log('----------');
}

const overloads_lines: string[] = [];
for (const [method, method_overloads_lines] of objectEntries(overloads)) {
	if (method_overloads_lines.length > 0) {
		overloads_lines.push(
			...method_overloads_lines,
			`${getFunctionName(method)}(route: string, args?: Record<string, unknown>): Promise<unknown> {`,
			`\treturn this.fetch('${method}', this.fillRoute(route, args), args);`,
			`}`,
			'',
		);
	}
}

try {
	rmdirSync(output_path, { recursive: true });
} catch {
	// ignore
}

mkdirSync(output_src_path, { recursive: true });
await Promise.all([
	copyTemplateFile('.npmignore'),
	copyTemplateFile('src/client-base.ts'),
	copyTemplateFile('src/types.ts'),
	createPackageJson(),
	createTsconfigJson(),
]);

let contents = readFileSync(
	`${import.meta.dirname}/../template/src/main.${options.type}.ts`,
	'utf8',
);

contents = contents
	.replace('// MARK: imports', import_lines.join('\n'))
	.replace('// MARK: overloads', overloads_lines.join('\n\t'));

if (options.type === 'tasq') {
	contents = contents.replace('MARK: tasq-topic', options.tasq.topic);
}

const output_entrypoint_path = nodePath.join(output_src_path, 'main.ts');
writeFileSync(output_entrypoint_path, contents);

await tsdown.build({
	cwd: output_path,
	entry: output_entrypoint_path,
	outDir: nodePath.join(output_path, 'dist'),
	format: ['esm', 'cjs'],
	logLevel: 'warn',
});
