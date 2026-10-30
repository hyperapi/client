import * as v from 'valibot';
import { hyperApi } from '../setup.js';

export const argsSchema = v.strictObject({});

export default hyperApi.module().action(() => {
	return { at: new Date() };
});
