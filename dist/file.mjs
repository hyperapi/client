import { output_path } from "./state.mjs";
import nodePath from "node:path";
import { copyFile } from "node:fs/promises";
//#region src/file.ts
/**
* Copies the template file to the target path.
* @param path The target path to copy the template file to.
*/
async function copyTemplateFile(...path) {
	await copyFile(nodePath.join(import.meta.dirname, "..", "template", ...path), nodePath.join(output_path, ...path));
}
//#endregion
export { copyTemplateFile };
