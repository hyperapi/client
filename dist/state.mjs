import nodePath from "node:path";
import * as v from "valibot";
import { program } from "@commander-js/extra-typings";
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
export { options, output_path, output_src_path, source_path };
