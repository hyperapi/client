import * as v from 'valibot';
import { hyperApi } from '../setup.js';

export const argsSchema = v.object({
	name: v.string(),
});

export default hyperApi
	.module()
	.use((request) => {
		return {
			args: v.parse(argsSchema, request.args),
		};
	})
	.action(() => {
		return {
			ok: true,
		};
	});
