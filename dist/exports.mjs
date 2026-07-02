import ts from "typescript";
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
export { scanExports };
