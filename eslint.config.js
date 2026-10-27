import { eslint } from '@kirick/lint/eslint';
import { defineConfig, globalIgnores } from 'eslint/config';

// test/*/build/ is generated: `bun run test:types` type-checks it, linting it
// would only make the lint step depend on whether it has been generated yet.
export default defineConfig(eslint, globalIgnores(['test/*/build/']));
