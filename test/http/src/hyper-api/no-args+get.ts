import * as v from 'valibot';
import { hyperApi } from '../setup.js';

export const argsSchema = v.strictObject({});

export default hyperApi
	.module()
	.use((request) => {
		return {
			args: v.parse(argsSchema, request.args),
		};
	})
	.action(() => {
		return {
			method: 'no-args' as const,
			ok: true,
		};
	});
