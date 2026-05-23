import { hyperApi } from '../setup.js';

export default hyperApi
	.module()
	.set('args', { name: 'world' })
	.action((request) => {
		return {
			message: `hello, ${request.args.name}`,
		};
	});
