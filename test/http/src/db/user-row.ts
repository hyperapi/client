/** Lives outside the API directory: not meant for the client. */
export type DbUserRow = {
	id: number;
	email_address: string;
	password_hash: string;
};
