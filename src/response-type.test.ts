import nodePath from 'node:path';
import { expect, test } from 'vitest';
import { resolveResponse } from './response-type.js';

const ROOT = nodePath.join(import.meta.dirname, '../test/http/src');

test('resolves an inferred response to its literal shape', () => {
	const resolved = resolveResponse(
		nodePath.join(ROOT, 'hyper-api/echo+get.ts'),
	);

	expect(resolved?.text).toBe('{ message: string; }');
	expect(resolved?.references).toStrictEqual([]);
});

test('names a referenced type instead of expanding it', () => {
	const resolved = resolveResponse(
		nodePath.join(ROOT, 'hyper-api-fixtures/leaky-route.ts'),
	);

	// `Pick` is TypeScript's own, so it needs no import; `DbUserRow` does.
	expect(resolved?.text).toBe('Pick<DbUserRow, "id">');
	expect(
		resolved?.references.map(({ name, is_ambient, is_exported }) => {
			return { name, is_ambient, is_exported };
		}),
	).toStrictEqual([
		// A global, so it is reachable without an import of its own.
		{ name: 'Pick', is_ambient: true, is_exported: true },
		{ name: 'DbUserRow', is_ambient: false, is_exported: true },
	]);
});

test('stops at a nameable type rather than expanding its members', () => {
	// A Date field must come back as `Date`, not as its eighty method signatures.
	const resolved = resolveResponse(
		nodePath.join(ROOT, 'hyper-api-fixtures/dated-route.ts'),
	);

	expect(resolved?.text).toBe('{ at: Date; }');
	expect(resolved?.references.map(({ name }) => name)).toStrictEqual(['Date']);
});
