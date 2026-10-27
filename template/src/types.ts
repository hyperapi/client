import type { HyperAPIModule } from '@hyperapi/core/dev';
import type { IsEmptyObject } from 'type-fest';

export type WrapArgs<A> = IsEmptyObject<A> extends true ? [] : [A];

export type ExtractModuleResponse<Module> =
	Module extends HyperAPIModule<infer _Request, infer Extra, infer _Resp>
		? Extra extends {
				response: infer Response;
			}
			? Response
			: undefined
		: never;
