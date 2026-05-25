import type { HyperAPIModule } from '@hyperapi/core/dev';

export type ExtractModuleResponse<Module> =
	Module extends HyperAPIModule<infer _Request, infer Extra>
		? Extra extends {
				response: infer Response;
			}
			? Response
			: undefined
		: never;
