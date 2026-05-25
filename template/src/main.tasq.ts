// oxlint-disable no-unused-vars

import type { HyperAPIMethod } from '@hyperapi/core/dev';
import type { Tasq } from '@kirick/tasq';
import type { Simplify } from 'type-fest';
import * as v from 'valibot';
import { ClientBase } from './client-base.js';
import type { ExtractModuleResponse } from './types.js';

// MARK: imports

const parseResponse = v.parser(
	v.union([
		v.tuple([v.literal(true), v.unknown()]),
		v.tuple([
			v.literal(false),
			v.object({
				code: v.number(),
				description: v.string(),
				data: v.optional(v.unknown()),
			}),
		]),
	]),
);

// eslint-disable-next-line no-restricted-exports
export default class Client extends ClientBase {
	#tasq: Tasq;

	constructor(tasq: Tasq) {
		super();

		this.#tasq = tasq;
	}

	// MARK: overloads

	protected async fetch(
		_method: HyperAPIMethod,
		path: string,
		args?: Record<string, unknown>,
	): Promise<unknown> {
		const response = parseResponse(
			await this.#tasq.request('MARK: tasq-topic', path, args),
		);
		if (!response[0]) {
			throw new Client.Error(
				response[1].code,
				response[1].description,
				response[1].data,
			);
		}

		return response[1];
	}
}
