#!/usr/bin/env node
import { options, output_path, output_src_path, source_path } from "./state.mjs";
import { createPackageJson } from "./configs/package.json.mjs";
import { createTsconfigJson } from "./configs/tsconfig.json.mjs";
import { scanExports } from "./exports.mjs";
import { copyTemplateFile } from "./file.mjs";
import fs from "node:fs";
import nodePath from "node:path";
import { getRoutes } from "@hyperapi/core/dev";
import * as tsdown from "tsdown";
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
{
	const types_path = nodePath.join(process.cwd(), source_path, "..", "hyper-api.client.ts");
	if (fs.existsSync(types_path)) {
		const import_path = nodePath.relative(output_src_path, types_path);
		import_lines.push(`export type * from '${import_path}';`);
	}
}
try {
	fs.rmSync(output_path, { recursive: true });
} catch {}
fs.mkdirSync(output_src_path, { recursive: true });
await Promise.all([
	copyTemplateFile(".npmignore"),
	copyTemplateFile("src/client-base.ts"),
	copyTemplateFile("src/types.ts"),
	createPackageJson(),
	createTsconfigJson()
]);
let contents = fs.readFileSync(`${import.meta.dirname}/../template/src/main.${options.type}.ts`, "utf8");
contents = contents.replace("// MARK: imports", import_lines.join("\n")).replace("// MARK: overloads", overloads_lines.join("\n	"));
if (options.type === "tasq") contents = contents.replace("MARK: tasq-topic", options.tasq.topic);
const output_entrypoint_path = nodePath.join(output_src_path, "main.ts");
fs.writeFileSync(output_entrypoint_path, contents);
await tsdown.build({
	cwd: output_path,
	entry: output_entrypoint_path,
	outDir: nodePath.join(output_path, "dist"),
	format: ["esm", "cjs"],
	logLevel: "warn"
});
//#endregion
export {};
