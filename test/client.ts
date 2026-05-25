import Client from './build/src/main.js';

const client = new Client('https://example.com/api');

const _response1 = await client.get('/echo', { name: 'John' });

const _response2 = await client.get('/users/:user_id', { user_id: 1 });
const _response3 = await client.get('/users/:user_id', {
	user_id: 1,
	is_short: 1,
});

const _response4 = await client.get('/items', { user_id: 1 });
const _response5 = await client.get('/items', { user_id: 1, add_user: 1 });
