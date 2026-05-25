import { configCommon } from '@kirick/lint/eslint/common';
import { configNode } from '@kirick/lint/eslint/node';
import { configOxlint } from '@kirick/lint/eslint/oxlint';
import { defineConfig } from 'eslint/config';

export default defineConfig([
	{
		ignores: ['dist/**', 'src-other/**', 'test-build/**', 'test-client.ts'],
	},
	...configCommon,
	...configNode,
	...configOxlint,
]);
