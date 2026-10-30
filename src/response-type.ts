import nodePath from 'node:path';
import ts from 'typescript';

/** A named type the response refers to. */
export type TypeReference = {
	name: string;
	/** Absolute path of the file that declares it. */
	file: string;
	/**
	 * Whether it can be referenced from elsewhere: either its module exports
	 * it, or it is a global and needs no import at all.
	 */
	is_exported: boolean;
	/** Declared by TypeScript itself or a dependency, so always available. */
	is_ambient: boolean;
};

export type ResolvedResponse = {
	/** The response type as source text, naming types rather than expanding them. */
	text: string;
	references: TypeReference[];
};

/**
 * Records a symbol without descending into it: once a type can be named, the
 * name is the reference. Descending instead is what turns a `Date` field into
 * its eighty method signatures.
 * @param checker - The type checker the symbol came from.
 * @param symbol - The symbol to describe.
 * @returns -
 */
function describe(
	checker: ts.TypeChecker,
	symbol: ts.Symbol | undefined,
): TypeReference | undefined {
	const declaration = symbol?.getDeclarations()?.[0];
	if (!symbol || !declaration) {
		return undefined;
	}

	const file = declaration.getSourceFile().fileName;
	const module_symbol = checker.getSymbolAtLocation(
		declaration.getSourceFile(),
	);

	return {
		name: symbol.getName(),
		file,
		is_exported:
			module_symbol === undefined
			|| checker
				.getExportsOfModule(module_symbol)
				.some((exported) => exported.getName() === symbol.getName()),
		is_ambient:
			file.includes('node_modules') || /\blib\.[a-z0-9.]*d\.ts$/u.test(file),
	};
}

/**
 * Collects every named type a type refers to.
 * @param checker - The type checker the type came from.
 * @param type - The type to walk.
 * @param found - Accumulator, keyed by name.
 * @param seen - Types already walked, to survive recursive types.
 */
function collect(
	checker: ts.TypeChecker,
	type: ts.Type,
	found: Map<string, TypeReference>,
	seen: Set<ts.Type>,
): void {
	if (seen.has(type)) {
		return;
	}

	seen.add(type);

	/**
	 * @param symbol - The symbol to record.
	 * @returns Whether it was nameable, and so whether to stop descending.
	 */
	function wasRecorded(symbol: ts.Symbol | undefined): boolean {
		const reference = describe(checker, symbol);
		// Anonymous object types are named `__object`; they have nothing to cite.
		if (!reference || reference.name.startsWith('__')) {
			return false;
		}

		found.set(reference.name, reference);
		return true;
	}

	if (wasRecorded(type.aliasSymbol)) {
		for (const argument of type.aliasTypeArguments ?? []) {
			collect(checker, argument, found, seen);
		}

		return;
	}

	const reference = type as ts.TypeReference;
	if (reference.target && reference.target !== type) {
		wasRecorded(reference.target.aliasSymbol ?? reference.target.symbol);
		for (const argument of checker.getTypeArguments(reference)) {
			collect(checker, argument, found, seen);
		}

		return;
	}

	if (type.isUnionOrIntersection()) {
		for (const member of type.types) {
			collect(checker, member, found, seen);
		}

		return;
	}

	// oxlint-disable-next-line no-bitwise -- TypeScript's type flags are a bit mask
	if ((type.flags & ts.TypeFlags.Object) !== 0) {
		if (wasRecorded(type.symbol)) {
			return;
		}

		for (const property of checker.getPropertiesOfType(type)) {
			const declaration = property.getDeclarations()?.[0];
			if (declaration) {
				collect(
					checker,
					checker.getTypeOfSymbolAtLocation(property, declaration),
					found,
					seen,
				);
			}
		}
	}
}

/**
 * Resolves the response type of a route module's default export.
 * @param path - Path to the route module.
 * @returns The response as text plus the named types it cites, or `undefined`
 * when the module's shape is not what this expects.
 */
export function resolveResponse(path: string): ResolvedResponse | undefined {
	const program = ts.createProgram([path], {
		target: ts.ScriptTarget.ESNext,
		module: ts.ModuleKind.ESNext,
		moduleResolution: ts.ModuleResolutionKind.Bundler,
		strict: true,
	});

	const checker = program.getTypeChecker();
	const source_file = program.getSourceFile(path);
	const module_symbol = source_file && checker.getSymbolAtLocation(source_file);
	if (!source_file || !module_symbol) {
		return undefined;
	}

	const default_export = checker
		.getExportsOfModule(module_symbol)
		.find((symbol) => symbol.getName() === 'default');
	const declaration = default_export?.getDeclarations()?.[0];
	if (!default_export || !declaration) {
		return undefined;
	}

	// The module's second type argument accumulates what the chain added; the
	// response is the member `action()` put there.
	const module_type = checker.getTypeOfSymbolAtLocation(
		default_export,
		declaration,
	);
	const extra = checker.getTypeArguments(module_type as ts.TypeReference)[1];
	const response_symbol = extra && checker.getPropertyOfType(extra, 'response');
	const response_declaration = response_symbol?.getDeclarations()?.[0];
	if (!response_symbol) {
		return undefined;
	}

	const response = response_declaration
		? checker.getTypeOfSymbolAtLocation(response_symbol, response_declaration)
		: checker.getTypeOfSymbolAtLocation(response_symbol, declaration);

	const found = new Map<string, TypeReference>();
	collect(checker, response, found, new Set());

	return {
		text: checker.typeToString(
			response,
			undefined,
			ts.TypeFormatFlags.NoTruncation,
		),
		references: Array.from(found.values(), (reference) => {
			return {
				...reference,
				file: nodePath.resolve(reference.file),
			};
		}),
	};
}
