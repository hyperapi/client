import * as v from 'valibot';
import type { DbUserRow } from '../db/user-row.js';
import { hyperApi } from '../setup.js';

export const argsSchema = v.strictObject({});

export default hyperApi.module().action((): Pick<DbUserRow, 'id'> => {
	return { id: 1 };
});
