#!/usr/bin/env node
import { mkdirSync, readFileSync, rmdirSync, writeFileSync } from "node:fs";
import nodePath from "node:path";
import { getRoutes } from "@hyperapi/core/dev";
import * as tsdown from "tsdown";
import { copyFile, readFile, writeFile } from "node:fs/promises";
import * as v from "valibot";
import { program } from "@commander-js/extra-typings";
import ts from "typescript";
//#region src/state.ts
program.argument("<source>").requiredOption("-d, --out-dir <value>", "output directory for the generated client").requiredOption("--type <value>", "client type (http, tasq)").option("--topic <value>", "Tasq topic to use (when type = tasq)").requiredOption("--name <value>", "generated package name");
program.parse();
const options = v.parse(v.intersect([v.object({
	outDir: v.string(),
	name: v.string()
}), v.variant("type", [v.pipe(v.object({
	type: v.literal("tasq"),
	topic: v.string()
}), v.transform((value) => {
	return {
		type: "tasq",
		tasq: { topic: value.topic }
	};
})), v.pipe(v.object({ type: v.literal("http") }), v.transform(() => {
	return {
		type: "http",
		http: {}
	};
}))])]), program.opts());
if (!program.args[0]) throw new Error("source file is required.");
const source_path = program.args[0];
const output_path = nodePath.join(process.cwd(), options.outDir);
const output_src_path = nodePath.join(output_path, "src");
//#endregion
//#region src/configs/package.json.ts
const parsePackageJson = v.parser(v.pipe(v.string(), v.parseJson(), v.object({
	version: v.string(),
	dependencies: v.record(v.string(), v.string()),
	optionalDependencies: v.record(v.string(), v.string()),
	devDependencies: v.record(v.string(), v.string())
}), v.transform((value) => {
	return {
		version: value.version,
		allDependencies: {
			...value.dependencies,
			...value.optionalDependencies,
			...value.devDependencies
		}
	};
}), v.check((value) => value.allDependencies["@hyperapi/core"] !== void 0, "Missing @hyperapi/core dependency")));
const PACKAGE_JSON = parsePackageJson(await readFile(nodePath.join(import.meta.dirname, "../package.json"), "utf8"));
/** Creates package.json for the client library. */
async function createPackageJson() {
	const data = parsePackageJson(await readFile(nodePath.join(process.cwd(), "package.json"), "utf8"));
	await writeFile(nodePath.join(output_path, "package.json"), JSON.stringify({
		name: options.name,
		version: data.version,
		type: "module",
		main: "dist/main.mjs",
		types: "dist/main.d.mts",
		exports: { ".": {
			types: {
				import: "./dist/main.d.mts",
				require: "./dist/main.d.cts"
			},
			import: "./dist/main.mjs",
			require: "./dist/main.cjs"
		} },
		dependencies: {
			"@hyperapi/core": data.allDependencies["@hyperapi/core"],
			"type-fest": data.allDependencies["type-fest"] ?? PACKAGE_JSON.allDependencies["type-fest"],
			valibot: data.allDependencies.valibot ?? PACKAGE_JSON.allDependencies.valibot
		},
		peerDependencies: { "@kirick/tasq": data.allDependencies["@kirick/tasq"] ?? PACKAGE_JSON.allDependencies["@kirick/tasq"] }
	}, null, "	"), "utf8");
}
//#endregion
//#region src/configs/tsconfig.json.ts
/** Creates tsconfig.json for the client library. */
async function createTsconfigJson() {
	const content = await readFile(nodePath.join(import.meta.dirname, "..", "tsconfig.json"), "utf8");
	const tsconfig = JSON.parse(content);
	tsconfig.compilerOptions.isolatedDeclarations = false;
	await writeFile(nodePath.join(output_path, "tsconfig.json"), JSON.stringify(tsconfig, null, "	"), "utf8");
}
//#endregion
//#region src/exports.ts
/**
* Returns exports of a TypeScript file.
* @param path - The path to the TypeScript file to scan.
* @returns An array of objects representing the exports of the file.
*/
function scanExports(path) {
	const program = ts.createProgram([path], {
		target: ts.ScriptTarget.ESNext,
		module: ts.ModuleKind.ESNext
	});
	const checker = program.getTypeChecker();
	const sourceFile = program.getSourceFile(path);
	if (!sourceFile) throw new Error("Source file not found");
	const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
	if (!moduleSymbol) return {};
	const exports = checker.getExportsOfModule(moduleSymbol);
	return Object.fromEntries(exports.map((symbol) => {
		const is_type = (symbol.getDeclarations() ?? []).some((decl) => ts.isTypeAliasDeclaration(decl) || ts.isInterfaceDeclaration(decl));
		return [symbol.getName(), { is_type }];
	}));
}
//#endregion
//#region src/file.ts
/**
* Copies the template file to the target path.
* @param path The target path to copy the template file to.
*/
async function copyTemplateFile(...path) {
	await copyFile(nodePath.join(import.meta.dirname, "..", "template", ...path), nodePath.join(output_path, ...path));
}
//#endregion
//#region src/main.ts
/**
*　Returns an array of key/values of the enumerable own properties of an object
* @param o Object that contains the properties and methods. This can be an object that you created or an existing Document Object Model (DOM) object.
* @returns
*/
function objectEntries(o) {
	return Object.entries(o);
}
/**
* Returns the function name for a given HTTP method.
* @param method - The HTTP method to get the function name for.
* @returns The function name for the given HTTP method.
*/
function getFunctionName(method) {
	return method === "UNDEF" ? "query" : method.toLowerCase();
}
const import_lines = [];
const overloads = {
	GET: [],
	OPTIONS: [],
	POST: [],
	PUT: [],
	PATCH: [],
	DELETE: [],
	UNDEF: []
};
for (const [index, route] of getRoutes(source_path).entries()) {
	const exports = scanExports(route.file_path);
	if (exports.argsSchema === void 0) throw new Error(`No exported argsSchema found in ${route.file_path}.`);
	else if (exports.argsSchema.is_type) throw new Error(`Exported argsSchema is not a value in ${route.file_path}.`);
	if (exports.default === void 0) throw new Error(`No default export found in ${route.file_path}.`);
	else if (exports.default.is_type) throw new Error(`Exported default is not a value in ${route.file_path}.`);
	if (exports.ResponseType && !exports.ResponseType.is_type) throw new Error(`Exported ResponseType is not a type in ${route.file_path}.`);
	const has_response_type = exports.ResponseType !== void 0;
	{
		const import_path = nodePath.relative(output_src_path, nodePath.join(process.cwd(), route.file_path));
		const imports = [`argsSchema as argsSchema${index}`];
		if (has_response_type) imports.push(`ResponseType as ResponseType${index}`);
		else imports.push(`default as module${index}`);
		import_lines.push(`import type { ${imports.join(", ")} } from '${import_path}';`);
	}
	{
		const type_params = has_response_type ? `<const A extends v.InferInput<typeof argsSchema${index}>>` : "";
		const type_args = has_response_type ? "A" : `v.InferInput<typeof argsSchema${index}>`;
		const type_return = has_response_type ? `ResponseType${index}<A>` : `ExtractModuleResponse<typeof module${index}>`;
		overloads[route.method].push(`${getFunctionName(route.method)}${type_params}(route: '${route.route}', args: ${type_args}): Promise<Simplify<${type_return}>>;`);
	}
}
const overloads_lines = [];
for (const [method, method_overloads_lines] of objectEntries(overloads)) if (method_overloads_lines.length > 0) overloads_lines.push(...method_overloads_lines, `${getFunctionName(method)}(route: string, args?: Record<string, unknown>): Promise<unknown> {`, `\treturn this.fetch('${method}', this.fillRoute(route, args), args);`, `}`, "");
try {
	rmdirSync(output_path, { recursive: true });
} catch {}
mkdirSync(output_src_path, { recursive: true });
await Promise.all([
	copyTemplateFile(".npmignore"),
	copyTemplateFile("src/client-base.ts"),
	copyTemplateFile("src/types.ts"),
	createPackageJson(),
	createTsconfigJson()
]);
let contents = readFileSync(`${import.meta.dirname}/../template/src/main.${options.type}.ts`, "utf8");
contents = contents.replace("// MARK: imports", import_lines.join("\n")).replace("// MARK: overloads", overloads_lines.join("\n	"));
if (options.type === "tasq") contents = contents.replace("MARK: tasq-topic", options.tasq.topic);
const output_entrypoint_path = nodePath.join(output_src_path, "main.ts");
writeFileSync(output_entrypoint_path, contents);
await tsdown.build({
	cwd: output_path,
	entry: output_entrypoint_path,
	outDir: nodePath.join(output_path, "dist"),
	format: ["esm", "cjs"],
	logLevel: "warn"
});
//#endregion
export {};
