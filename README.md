# HyperAPI Client Generator

[![npm version](https://img.shields.io/npm/v/@hyperapi/client.svg)](https://www.npmjs.com/package/@hyperapi/client)
[![license](https://img.shields.io/npm/l/@hyperapi/client.svg?color=blue)](https://github.com/hyperapi/client/blob/main/LICENSE)

Generates a typed client SDK from a HyperAPI server's method files. It reads the same file tree your server routes from, and writes a standalone, publishable package whose call signatures are derived from your `argsSchema` and `ResponseType` exports.

## Features

- 🔒 **End-to-end type safety** - Call signatures and response shapes come from the server's own modules, so a change to a schema shows up as a type error at the call site
- 🧩 **File-based, like the server** - The same routing rules as [HyperAPI Core](https://github.com/hyperapi/core); no route list to maintain by hand
- 🚚 **Transport-aware** - `--type=http` emits one method per HTTP verb, `--type=tasq` emits a single `send()`
- 📦 **A real package** - Writes `package.json`, a standalone `tsconfig.json` and a built `dist/` (ESM + CJS) ready to publish
- 🌐 **Browser-ready** - The generated declarations reference only web APIs, with no `@types/node` for consumers to install

## Installation

```bash
bun i -D @hyperapi/client
# or with pnpm
pnpm add -D @hyperapi/client
# or with npm
npm install -D @hyperapi/client
```

## Quick Start

Point it at the directory holding your API methods and say where to write the client:

```bash
bunx @hyperapi/client \
  --name=@my-org/api-client \
  --type=http \
  -d ../api-client \
  src/hyper-api
```

That reads every module under `src/hyper-api`, writes the client into `../api-client`, and builds it. The result is used like this:

```typescript
import Client from '@my-org/api-client';

const client = new Client('https://example.com/api');

// `{ user: ApiUser }`, inferred from the server module.
const { user } = await client.get('/users/:user_id', { user_id: 1 });

// Type error: `/users/:user_id` has no POST module.
await client.post('/users/:user_id', { user_id: 1 });
```

### Options

| Option | Required | Description |
| - | - | - |
| `<source>` | yes | Directory holding the API method files — the same path your server passes to `HyperAPI` |
| `-d, --out-dir <path>` | yes | Where to write the generated package. **The directory is wiped on every run**, so give it one of its own |
| `--type <http \| tasq>` | yes | Which transport the client talks over |
| `--name <name>` | yes | `name` field for the generated `package.json` |
| `--topic <topic>` | with `--type=tasq` | Tasq topic the client sends requests to |

### What gets generated

```
api-client/
├── src/
│   ├── main.ts         # the Client class, written from your route tree
│   ├── client-base.ts  # route filling and the error class
│   └── types.ts        # helper types
├── dist/               # built ESM + CJS, with .d.mts / .d.cts
├── package.json        # name/version from yours, only the deps the client needs
└── tsconfig.json       # standalone: nothing left to `extends`
```

Only `dist/` is published (`files: ["dist/"]`). The generated `src/main.ts` imports your server modules by relative path to derive their types, so the output directory is meant to be built where those paths resolve — next to the server, not copied elsewhere.

## Exporting your own types: `hyper-api.client.ts`

A route module's `ResponseType` usually names types of its own — a `User`, an `Order` — and consumers of the client need them too. To re-export types from the generated client, put them in a file named **exactly** `hyper-api.client.ts`, sitting **next to** the directory passed as `<source>`:

```
src/
├── hyper-api/              # <source>
│   ├── users/
│   │   └── [user_id]+get.ts
│   └── items+get.ts
└── hyper-api.client.ts     # beside it, not inside it
```

```typescript
// src/hyper-api.client.ts
export type { ApiUser, ApiUserShort } from './hyper-api/users/[user_id]+get.js';
export type { Item } from './hyper-api/items+get.js';
```

Everything it exports becomes part of the generated client's public surface:

```typescript
import Client, { type ApiUser } from '@my-org/api-client';
```

> [!IMPORTANT]
> The name is a convention and is not configurable. The generator looks for `hyper-api.client.ts` as a sibling of the source directory and nothing else — a differently named file is simply not picked up, with no warning. The file is optional: without it, the client exports only its own `Client` class.

It is pulled in with `export type *`, so only types pass through. Values exported from it are ignored.

## Transports

### HTTP (`--type=http`)

One method per HTTP verb present in your route tree, named after it in lowercase:

```typescript
const client = new Client('https://example.com/api'); // no trailing slash

client.headers.set('Authorization', `Bearer ${token}`); // sent with every request

await client.get('/echo', { name: 'John' });  // args become query parameters
await client.post('/echo', { name: 'John' }); // args become a JSON body
```

Route parameters are filled from the same args object: `client.get('/users/:user_id', { user_id: 1 })` requests `/users/1`.

Because `GET` args are serialized into `URLSearchParams`, they have to be strings, numbers or bigints — nested objects and arrays throw a `TypeError`, as there is no standard way to encode them.

### Tasq (`--type=tasq`)

Tasq has no HTTP verbs, so its modules carry no `+verb` suffix and HyperAPI Core files them under the `UNDEF` pseudo-method. The client gets a single `send()` and no verb methods at all:

```typescript
import { createTasq } from '@kirick/tasq';
import Client from '@my-org/api-client';

const client = new Client(await createTasq(redisClient));

await client.send('/users/:user_id', { user_id: 1 });
```

The topic given as `--topic` is baked into the generated client, so callers do not repeat it.

## Error handling

Non-OK responses are thrown as `Client.Error`, carrying the fields HyperAPI's drivers report:

```typescript
try {
  await client.get('/users/:user_id', { user_id: 1 });
} catch (error) {
  if (error instanceof Client.Error) {
    console.error(error.code, error.description, error.data);
  }
}
```

## Development

`bun run check` is what CI runs, in four steps: lint, build the test clients, run the tests, build this package.

The fixtures live in two independent trees, one per transport:

```
test/
├── http/            # +verb filenames -> get() / post()
│   ├── src/         # a fixture HyperAPI server, with its hyper-api.client.ts
│   ├── build/       # generated client (gitignored)
│   ├── client.ts    # type-only assertions about the generated client
│   └── tsconfig.json
└── tasq/            # verb-less filenames -> send()
    └── ...
```

`client.ts` in each tree is never executed — there is no server to call, so the contract under test is entirely types. `tsc -p test/<transport>/tsconfig.json` is the test, and it is what checks the `expectTypeOf` assertions; `vitest run` would treat them as no-ops.

## Contributing

Issues and pull requests are welcome at [our GitHub repository](https://github.com/hyperapi/client).
