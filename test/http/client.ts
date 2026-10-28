// Type-only checks for the generated client: there is no server to call, so the
// whole contract under test is the types. Nothing runs this file — `tsc -p
// test/http/tsconfig.json` is the test, and `expectTypeOf` is checked by it.
//
// Compiling on its own would not be enough. A response type that collapsed to
// `never` still type-checks at every call site, so each one is pinned exactly.

import { expectTypeOf } from 'vitest';
import Client, { type ApiUser, type ApiUserShort } from './build/src/main.js';

/** Not exported by the module, so it is restated here. */
type Item = {
	id: number;
	title: string;
};

const client = new Client('https://example.com/api');

// No args at all: `WrapArgs` drops the parameter.
const response0 = await client.get('/no-args');
expectTypeOf(response0).toEqualTypeOf<{ method: 'no-args'; ok: boolean }>();

const response1 = await client.get('/echo', { name: 'John' });
expectTypeOf(response1).toEqualTypeOf<{ message: string }>();

// `ResponseType` picks the shape out of the args it was called with.
const response2 = await client.get('/users/:user_id', { user_id: 1 });
expectTypeOf(response2).toEqualTypeOf<{ user: ApiUser }>();

const response3 = await client.get('/users/:user_id', {
	user_id: 1,
	is_short: 1,
});
expectTypeOf(response3).toEqualTypeOf<{ user: ApiUserShort }>();

const response4 = await client.get('/items', { user_id: 1 });
expectTypeOf(response4).toEqualTypeOf<{ items: Item[]; user: undefined }>();

const response5 = await client.get('/items', { user_id: 1, add_user: 1 });
expectTypeOf(response5).toEqualTypeOf<{ items: Item[]; user: ApiUserShort }>();

const response6 = await client.post('/echo', { name: 'John' });
expectTypeOf(response6).toEqualTypeOf<{ ok: boolean }>();

// QUERY gets its own method off the same route, like any other verb.
const response11 = await client.query('/echo', { name: 'John' });
expectTypeOf(response11).toEqualTypeOf<{ queried: boolean }>();

// @ts-expect-error -- route does not exist
const _response7 = await client.get('/hello', { name: 'John' });

// @ts-expect-error -- route exists, but not for this method
const _response8 = await client.post('/items', { user_id: 1 });

// @ts-expect-error -- `name` is a string
const _response9 = await client.get('/echo', { name: 123 });

// @ts-expect-error -- `name` is required
const _response10 = await client.get('/echo', {});
