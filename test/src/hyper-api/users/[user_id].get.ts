import * as v from 'valibot';
import { hyperApi } from '../../setup.js';

export const argsSchema = v.strictObject({
	user_id: v.number(),
	is_short: v.pipe(
		v.optional(v.picklist([0, 1]), 0),
		v.transform((value) => value === 1),
	),
});

export type ApiUserShort = {
	user_id: number;
	name: string;
};

type ApiUser = ApiUserShort & {
	friends_count: number;
};

// oxlint-disable-next-line typescript/no-explicit-any
export type ResponseType<P = any> = {
	user: P extends { is_short: 1 } ? ApiUserShort : ApiUser;
};

export default hyperApi
	.module()
	.use((request) => {
		return {
			args: v.parse(argsSchema, request.args),
		};
	})
	.action<ResponseType>((request) => {
		if (request.args.is_short) {
			return {
				user: {
					user_id: request.args.user_id,
					name: 'foobar',
				},
			};
		}

		return {
			user: {
				user_id: request.args.user_id,
				name: 'foobar',
				friends_count: 10,
			},
		};
	});
