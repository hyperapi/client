#!/usr/bin/env node

// oxlint-disable max-lines-per-function
// oxlint-disable max-statements
// oxlint-disable no-await-in-loop
// oxlint-disable unicorn/no-process-exit

import fs from 'node:fs';
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
	return method === 'UNDEF' ? 'send' : method.toLowerCase();
}

const import_lines: string[] = [];
// const overloads: Record<HyperAPIMethod, string[]> = {
// 	GET: [],
// 	OPTIONS: [],
// 	POST: [],
// 	PUT: [],
// 	PATCH: [],
// 	DELETE: [],
// 	UNDEF: [],
// };
const route_defs: Record<
	HyperAPIMethod,
	Record<string, { args: string; response: string }>
> = {
	GET: {},
	OPTIONS: {},
	POST: {},
	PUT: {},
	PATCH: {},
	DELETE: {},
	UNDEF: {},
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

	// // overloads
	// {
	// 	const type_params = has_response_type
	// 		? `<const A extends v.InferInput<typeof argsSchema${index}>>`
	// 		: '';
	// 	const type_args = has_response_type
	// 		? 'A'
	// 		: `v.InferInput<typeof argsSchema${index}>`;
	// 	const type_return = has_response_type
	// 		? `ResponseType${index}<A>`
	// 		: `ExtractModuleResponse<typeof module${index}>`;

	// 	overloads[route.method].push(
	// 		`${getFunctionName(route.method)}${type_params}(route: '${route.route}', ...args: WrapArgs<${type_args}>): Promise<Simplify<${type_return}>>;`,
	// 	);
	// }

	// route_defs
	route_defs[route.method][route.route] = {
		args: `v.InferInput<typeof argsSchema${index}>`,
		response: has_response_type
			? `ResponseType${index}<A>`
			: `ExtractModuleResponse<typeof module${index}>`,
	};

	// console.log('----------');
}

/** Capitalizes the first letter of a string and makes the rest lowercase. */
function capitalize(s: string): string {
	return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

const route_types_lines: string[] = [];
const class_methods_lines: string[] = [];
// for (const [method, method_overloads_lines] of objectEntries(overloads)) {
// 	if (method_overloads_lines.length > 0) {
// 		class_methods_lines.push(
// 			...method_overloads_lines,
// 			`${getFunctionName(method)}(route: string, args?: Record<string, unknown>): Promise<unknown> {`,
// 			`\treturn this.fetch('${method}', this.fillRoute(route, args), args);`,
// 			`}`,
// 			'',
// 		);
// 	}
// }
for (const [method, def] of objectEntries(route_defs)) {
	const routes = Object.keys(def);
	if (routes.length > 0) {
		let routes_union = '';
		const route_args_lines: string[] = [];
		const route_response_lines: string[] = [];
		for (const [route, { args, response }] of objectEntries(def)) {
			const route_quoted = JSON.stringify(route);
			routes_union += `| ${route_quoted}`;
			route_args_lines.push(`\t${route_quoted}: ${args}`);
			route_response_lines.push(`\t${route_quoted}: ${response}`);
		}

		const type_prefix = `Routes${capitalize(method)}`;
		route_types_lines.push(
			`type ${type_prefix}Args = {`,
			...route_args_lines,
			`};`,
			`type ${type_prefix}Response<A extends ${type_prefix}Args[keyof ${type_prefix}Args]> = {`,
			...route_response_lines,
			`};`,
		);

		class_methods_lines.push(
			`${getFunctionName(method)}<`,
			`\tconst R extends ${routes_union},`,
			`\tconst A extends ${type_prefix}Args[R],`,
			`\tconst Rs extends ${type_prefix}Response<A>[R]`,
			`>(route: R, ...args: WrapArgs<A>): Promise<Simplify<Rs>> {`,
			`\treturn this.fetch('${method}', this.fillRoute(route, args[0]), args[0]) as Promise<Simplify<Rs>>;`,
			`}`,
			'',
		);
	}
}

{
	const types_path = nodePath.join(
		process.cwd(),
		source_path,
		'..',
		'hyper-api.client.ts',
	);
	if (fs.existsSync(types_path)) {
		const import_path = nodePath.relative(output_src_path, types_path);
		import_lines.push(`export type * from '${import_path}';`);
	}
}

try {
	fs.rmSync(output_path, { recursive: true });
} catch {
	// ignore
}

fs.mkdirSync(output_src_path, { recursive: true });
await Promise.all([
	copyTemplateFile('.npmignore'),
	copyTemplateFile('src/client-base.ts'),
	copyTemplateFile('src/types.ts'),
	createPackageJson(),
	createTsconfigJson(),
]);

let contents = fs.readFileSync(
	`${import.meta.dirname}/../template/src/main.${options.type}.ts`,
	'utf8',
);

contents = contents
	.replace('// MARK: imports', import_lines.join('\n'))
	.replace('// MARK: route types', route_types_lines.join('\n'))
	.replace('// MARK: class methods', class_methods_lines.join('\n\t'));

if (options.type === 'tasq') {
	contents = contents.replace('MARK: tasq-topic', options.tasq.topic);
}

const output_entrypoint_path = nodePath.join(output_src_path, 'main.ts');
fs.writeFileSync(output_entrypoint_path, contents);

await tsdown.build({
	cwd: output_path,
	entry: output_entrypoint_path,
	outDir: nodePath.join(output_path, 'dist'),
	format: ['esm', 'cjs'],
	logLevel: 'warn',
});
