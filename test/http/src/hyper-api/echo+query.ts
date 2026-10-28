import * as v from 'valibot';
import { hyperApi } from '../setup.js';

export const argsSchema = v.object({
	name: v.string(),
});

export default hyperApi.module().action(() => {
	return {
		queried: true,
	};
});
