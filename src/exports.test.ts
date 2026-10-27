import nodePath from 'node:path';
import { expect, test } from 'vitest';
import { scanExports } from './exports.js';

const FIXTURES_PATH = nodePath.join(
	import.meta.dirname,
	'../test/http/src/hyper-api',
);

test('tells a value export from a type export', () => {
	expect(scanExports(nodePath.join(FIXTURES_PATH, 'items+get.ts'))).toEqual({
		argsSchema: { is_type: false },
		default: { is_type: false },
		ResponseType: { is_type: true },
	});
});

test('reports no ResponseType when the module exports none', () => {
	const exports = scanExports(nodePath.join(FIXTURES_PATH, 'echo+get.ts'));

	expect(exports.argsSchema).toEqual({ is_type: false });
	expect(exports.default).toEqual({ is_type: false });
	expect(exports.ResponseType).toBeUndefined();
});
