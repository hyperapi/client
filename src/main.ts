// oxlint-disable unicorn/no-process-exit

import { program } from '@commander-js/extra-typings';
import { getRoutes } from '@hyperapi/core/dev';

const command = program
	.argument('<source>')
	.option(
		'--type <value>',
		'what client type to build (supported values: tasq, http)',
		(value) => {
			if (value === 'tasq' || value === 'http') {
				return value;
			}

			// oxlint-disable-next-line no-console
			console.error(
				`Invalid client type: ${value}. Supported values: tasq, http.`,
			);
			process.exit(1);
		},
	);

command.action((source, options) => {
	console.log('targetFile:', source);
	console.log('options:', options);
});

command.parse();

// getRoutes to get routes from given directory of hyper-api modules
