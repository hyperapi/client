class ClientError extends Error {
	constructor(
		readonly code: number,
		readonly description: string,
		readonly data: unknown,
	) {
		super(`Client error: ${description} (code ${code}).`);
	}
}

export class ClientBase {
	// oxlint-disable-next-line class-methods-use-this
	protected fillRoute(route: string, args?: Record<string, unknown>): string {
		return route
			.replaceAll(/:(?<key>\w+)(?:\+|\?)?/gu, (_, key) =>
				String(args?.[key] ?? ''),
			)
			.replace(/(?<!^)[/.]$/u, '');
	}

	static Error = ClientError;
}
