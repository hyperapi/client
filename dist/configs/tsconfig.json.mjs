import { output_path } from "../state.mjs";
import nodePath from "node:path";
import { readFile, writeFile } from "node:fs/promises";
//#region src/configs/tsconfig.json.ts
/** Creates tsconfig.json for the client library. */
async function createTsconfigJson() {
	const content = await readFile(nodePath.join(import.meta.dirname, "../../tsconfig.json"), "utf8");
	const tsconfig = JSON.parse(content);
	tsconfig.compilerOptions.isolatedDeclarations = false;
	await writeFile(nodePath.join(output_path, "tsconfig.json"), JSON.stringify(tsconfig, null, "	"), "utf8");
}
//#endregion
export { createTsconfigJson };
