// The same checks as test/http/client.ts, against the tasq variant. Tasq has no
// HTTP verbs, so these fixtures carry no `+verb` suffix: the router files them
// under the UNDEF pseudo-method and the generated client exposes a single
// `send()`. That, and the absence of `get()`, is what this file pins.
//
// Nothing runs this file — `tsc -p test/tasq/tsconfig.json` is the test.

import type { Tasq } from '@kirick/tasq';
import { expectTypeOf } from 'vitest';
import Client, { type ApiUser, type ApiUserShort } from './build/src/main.js';

/** Not exported by the module, so it is restated here. */
type Item = {
	id: number;
	title: string;
};

declare const tasq: Tasq;

const client = new Client(tasq);

// No args at all: `WrapArgs` drops the parameter.
const response0 = await client.send('/no-args');
expectTypeOf(response0).toEqualTypeOf<{ method: 'no-args'; ok: boolean }>();

const response1 = await client.send('/echo', { name: 'John' });
expectTypeOf(response1).toEqualTypeOf<{ message: string }>();

// `ResponseType` picks the shape out of the args it was called with.
const response2 = await client.send('/users/:user_id', { user_id: 1 });
expectTypeOf(response2).toEqualTypeOf<{ user: ApiUser }>();

const response3 = await client.send('/users/:user_id', {
	user_id: 1,
	is_short: 1,
});
expectTypeOf(response3).toEqualTypeOf<{ user: ApiUserShort }>();

const response4 = await client.send('/items', { user_id: 1 });
expectTypeOf(response4).toEqualTypeOf<{ items: Item[]; user: undefined }>();

const response5 = await client.send('/items', { user_id: 1, add_user: 1 });
expectTypeOf(response5).toEqualTypeOf<{ items: Item[]; user: ApiUserShort }>();

// @ts-expect-error -- this transport has no HTTP verbs
const _response6 = await client.get('/echo', { name: 'John' });

// @ts-expect-error -- route does not exist
const _response7 = await client.send('/hello', { name: 'John' });

// @ts-expect-error -- `name` is a string
const _response8 = await client.send('/echo', { name: 123 });

// @ts-expect-error -- `name` is required
const _response9 = await client.send('/echo', {});
