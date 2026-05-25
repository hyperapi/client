import ts from 'typescript';

/**
 * Returns exports of a TypeScript file.
 * @param path - The path to the TypeScript file to scan.
 * @returns An array of objects representing the exports of the file.
 */
export function scanExports(
	path: string,
): Record<string, { is_type: boolean }> {
	const program = ts.createProgram([path], {
		target: ts.ScriptTarget.ESNext,
		module: ts.ModuleKind.ESNext,
	});

	const checker = program.getTypeChecker();
	const sourceFile = program.getSourceFile(path);

	if (!sourceFile) {
		throw new Error('Source file not found');
	}

	const moduleSymbol = checker.getSymbolAtLocation(sourceFile);

	if (!moduleSymbol) {
		return {};
	}

	const exports = checker.getExportsOfModule(moduleSymbol);

	return Object.fromEntries(
		exports.map((symbol) => {
			const declarations = symbol.getDeclarations() ?? [];

			const is_type = declarations.some(
				(decl) =>
					ts.isTypeAliasDeclaration(decl) || ts.isInterfaceDeclaration(decl),
			);

			return [
				symbol.getName(),
				{
					is_type,
				},
			];
		}),
	);
}
