import { options, output_path } from "../state.mjs";
import nodePath from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import * as v from "valibot";
//#region src/configs/package.json.ts
const dependenciesSchema = v.optional(v.record(v.string(), v.string()), () => {
	return {};
});
const parsePackageJson = v.parser(v.pipe(v.string(), v.parseJson(), v.object({
	version: v.string(),
	dependencies: dependenciesSchema,
	optionalDependencies: dependenciesSchema,
	devDependencies: dependenciesSchema
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
const PACKAGE_JSON = parsePackageJson(await readFile(nodePath.join(import.meta.dirname, "../../package.json"), "utf8"));
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
export { createPackageJson };
