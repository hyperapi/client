import * as v from 'valibot';
import { hyperApi } from '../setup.js';
import type { ApiUserShort } from './users/[user_id].get.js';

export const argsSchema = v.strictObject({
	user_id: v.number(),
	add_user: v.pipe(
		v.optional(v.picklist([0, 1]), 0),
		v.transform((value) => value === 1),
	),
});

type Item = {
	id: number;
	title: string;
};

// oxlint-disable-next-line typescript/no-explicit-any
export type ResponseType<A = any> = {
	items: Item[];
	// user?: GuardIf<{ add_user: 1 }, ApiUserShort>;
	user: A extends { add_user: 1 } ? ApiUserShort : undefined;
};

export default hyperApi
	.module()
	.use((request) => {
		return {
			args: v.parse(argsSchema, request.args),
		};
	})
	.action<ResponseType>((request) => {
		const items: Item[] = [
			{ id: 1, title: 'foo' },
			{ id: 2, title: 'bar' },
			{ id: 3, title: 'baz' },
		];

		if (request.args.add_user) {
			return {
				items,
				user: {
					user_id: request.args.user_id,
					name: 'foobar',
				},
			};
		}

		return { items, user: undefined };
	});
