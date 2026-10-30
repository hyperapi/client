#!/usr/bin/env node

// oxlint-disable max-lines-per-function, max-statements, no-await-in-loop, unicorn/no-process-exit

import fs from 'node:fs';
import nodePath from 'node:path';
import { getRoutes, type HyperAPIMethod } from '@hyperapi/core/dev';
import * as tsdown from 'tsdown';
import { createPackageJson } from './configs/package.json.js';
import { scanExports } from './exports.js';
import { copyTemplateFile, PACKAGE_ROOT } from './file.js';
import { resolveResponse, type TypeReference } from './response-type.js';
import { options, output_path, output_src_path, source_path } from './state.js';

/**
 *　Returns an array of key/values of the enumerable own properties of an object
 * @param o Object that contains the properties and methods. This can be an object that you created or an existing Document Object Model (DOM) object.
 * @returns The key/value pairs of the object, typed by its own keys.
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
/** Type names already imported, so two routes citing `ApiUser` import it once. */
const imported_types = new Map<string, string>();
const lint_warnings: string[] = [];
const source_dir = nodePath.resolve(process.cwd(), source_path);

/**
 * Decides whether a resolved response can be written out as-is: every type it
 * names must be reachable from the generated file.
 * @param references - The named types the response cites.
 * @returns -
 */
function canInlineResponse(references: TypeReference[]): boolean {
	return references.every((reference) => {
		if (reference.is_ambient) {
			return true;
		}

		if (!reference.is_exported) {
			return false;
		}

		const claimed = imported_types.get(reference.name);
		return claimed === undefined || claimed === reference.file;
	});
}

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
	QUERY: {},
	UNDEF: {},
};

for (const [index, route] of getRoutes(source_path).entries()) {
	// console.log('----------');
	// console.log('route:', route);

	const exports = scanExports(route.file_path);
	// console.log('exports:', exports);

	if (exports.argsSchema === undefined) {
		throw new Error(`No exported argsSchema found in ${route.file_path}.`);
	}

	if (exports.argsSchema.is_type) {
		throw new Error(
			`Exported argsSchema is not a value in ${route.file_path}.`,
		);
	}

	if (exports.default === undefined) {
		throw new Error(`No default export found in ${route.file_path}.`);
	}

	if (exports.default.is_type) {
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
			nodePath.resolve(process.cwd(), route.file_path),
		);
		// console.log('import path =', import_path);

		const imports = [`argsSchema as argsSchema${index}`];
		if (has_response_type) {
			imports.push(`ResponseType as ResponseType${index}`);
		}

		// Resolving the response here keeps `HyperAPIModule` and everything the
		// middleware chain accumulated out of the generated types.
		// Resolved for every route: even where `ResponseType` is what gets
		// published, the action's own return type is what the lint can see.
		const resolved = resolveResponse(route.file_path);

		for (const reference of resolved?.references ?? []) {
			if (!reference.is_ambient && !reference.file.startsWith(source_dir)) {
				lint_warnings.push(
					`${route.file_path}: response type references \`${reference.name}\`, declared outside the API directory in ${nodePath.relative(process.cwd(), reference.file)}. Its whole declaration is published with the client.`,
				);
			}
		}

		const can_inline =
			!has_response_type
			&& resolved !== undefined
			&& canInlineResponse(resolved.references);
		if (!can_inline && !has_response_type) {
			imports.push(`default as module${index}`);
		}

		import_lines.push(
			`import type { ${imports.join(', ')} } from '${import_path}';`,
		);

		if (can_inline) {
			for (const reference of resolved.references) {
				if (reference.is_ambient || imported_types.has(reference.name)) {
					continue;
				}

				imported_types.set(reference.name, reference.file);
				import_lines.push(
					`import type { ${reference.name} } from '${nodePath.relative(output_src_path, reference.file)}';`,
				);
			}
		}

		// route_defs
		route_defs[route.method][route.route] = {
			args: `v.InferInput<typeof argsSchema${index}>`,
			response: has_response_type
				? `ResponseType${index}<A>`
				: can_inline
					? resolved.text
					: `ExtractModuleResponse<typeof module${index}>`,
		};
	}

	// console.log('----------');
}

if (lint_warnings.length > 0) {
	for (const warning of lint_warnings) {
		// oxlint-disable-next-line no-console
		console.warn(`warning: ${warning}`);
	}
}

/** Capitalizes the first letter of a string and makes the rest lowercase. */
function capitalize(s: string): string {
	return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

const route_types_lines: string[] = [];
const class_methods_lines: string[] = [];
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
	// Conventional name, sitting beside the API method directory: types the
	// generated client should re-export go in src/hyper-api.client.ts.
	const types_path = nodePath.resolve(
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
	copyTemplateFile('src/client-base.ts'),
	copyTemplateFile('src/types.ts'),
	copyTemplateFile('tsconfig.json'),
	createPackageJson(),
]);

let contents = fs.readFileSync(
	nodePath.join(PACKAGE_ROOT, 'template/src', `main.${options.type}.ts`),
	'utf8',
);

// The replacements are passed as functions: generated code may contain `$&`
// and friends, which `String#replace` would otherwise expand.
contents = contents
	.replace('// MARK: imports', () => import_lines.join('\n'))
	.replace('// MARK: route types', () => route_types_lines.join('\n'))
	.replace('// MARK: class methods', () => class_methods_lines.join('\n\t'));

if (options.type === 'tasq') {
	const { topic } = options.tasq;
	contents = contents.replace('MARK: tasq-topic', () => topic);
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
