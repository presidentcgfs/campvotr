/**
 * True if the user is an admin for the current organization
 * @param user
 * @returns
 */
export function isAdmin(user: { role?: string }) {
	return user.role?.toLowerCase() === 'admin' || user.role?.toLowerCase() === 'owner';
}
