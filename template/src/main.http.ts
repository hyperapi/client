// oxlint-disable no-unused-vars

import type { HyperAPIMethod } from '@hyperapi/core/dev';
import type { Simplify } from 'type-fest';
import * as v from 'valibot';
import { ClientBase } from './client-base.js';
import type { ExtractModuleResponse, WrapArgs } from './types.js';

// MARK: imports

const parseErrorResponse = v.parser(
	v.object({
		code: v.number(),
		description: v.string(),
		data: v.optional(v.unknown()),
	}),
);

// MARK: route types

// eslint-disable-next-line no-restricted-exports
export default class Client extends ClientBase {
	headers = new Headers();

	constructor(private readonly base_url: string) {
		super();
	}

	// MARK: class methods

	protected async fetch(
		method: HyperAPIMethod,
		path: string,
		args?: Record<string, unknown>,
	): Promise<unknown> {
		const url = new URL(this.base_url + path);
		const headers = new Headers(this.headers);
		let body;

		if (args) {
			if (method === 'GET') {
				// url.searchParams.append(name, value);
				for (const [name, value] of Object.entries(args)) {
					if (value === undefined) {
						continue;
					}

					if (typeof value === 'string') {
						url.searchParams.append(name, value);
					} else if (typeof value === 'number' || typeof value === 'bigint') {
						url.searchParams.append(name, String(value));
					} else if (typeof value === 'object') {
						throw new TypeError(
							`Unsupported argument type: ${typeof value}. URLSearchParams does not have a standard for nested objects or arrays.`,
						);
					} else {
						throw new TypeError(
							`Argument of type ${typeof value} can not be serialized into URLSearchParams.`,
						);
					}
				}
			} else {
				headers.append('Content-Type', 'application/json');
				body = JSON.stringify(args);
			}
		}

		const response = await fetch(url, {
			method,
			headers,
			body,
		});

		const response_body = await response.text();
		const response_data =
			response_body === '' ? undefined : JSON.parse(response_body);

		if (response.ok) {
			return response_data;
		}

		const error = parseErrorResponse(response_data);
		throw new Client.Error(error.code, error.description, error.data);
	}
}
