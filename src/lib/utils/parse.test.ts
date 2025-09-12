import { describe, it, expect } from 'vitest';
import { set } from './parse.js';

describe('set function', () => {
	it('should set simple property', () => {
		const result = set('name', 'John');
		expect(result).toEqual({ name: 'John' });
	});

	it('should set nested property', () => {
		const result = set('user.name', 'John');
		expect(result).toEqual({ user: { name: 'John' } });
	});

	it('should set deeply nested property', () => {
		const result = set('user.profile.personal.name', 'John');
		expect(result).toEqual({
			user: {
				profile: {
					personal: {
						name: 'John'
					}
				}
			}
		});
	});

	it('should set array element', () => {
		const result = set('items[0]', 'first item');
		expect(result).toEqual({ items: ['first item'] });
	});

	it('should set array element with higher index', () => {
		const result = set('items[2]', 'third item');
		expect(result).toEqual({ items: [undefined, undefined, 'third item'] });
	});

	it('should set property on array element', () => {
		const result = set('items[0].title', 'First Item');
		expect(result).toEqual({ items: [{ title: 'First Item' }] });
	});

	it('should set nested property on array element', () => {
		const result = set('data.users[1].profile.age', 25);
		expect(result).toEqual({
			data: {
				users: [undefined, { profile: { age: 25 } }]
			}
		});
	});

	it('should work with existing target object', () => {
		const target = { existing: 'value' };
		const result = set('new.property', 'test', target);
		expect(result).toEqual({
			existing: 'value',
			new: { property: 'test' }
		});
		expect(result).toBe(target); // Should modify the same object
	});

	it('should overwrite existing values', () => {
		const target = { user: { name: 'Old Name' } };
		const result = set('user.name', 'New Name', target);
		expect(result).toEqual({ user: { name: 'New Name' } });
	});

	it('should handle complex mixed scenarios', () => {
		const result = set('config.servers[0].databases[1].connection.host', 'localhost');
		expect(result).toEqual({
			config: {
				servers: [
					{
						databases: [
							undefined,
							{
								connection: {
									host: 'localhost'
								}
							}
						]
					}
				]
			}
		});
	});

	it('should handle empty path', () => {
		const target = { existing: 'value' };
		const result = set('', 'test', target);
		expect(result).toEqual({ existing: 'value' });
	});

	it('should throw error when trying to set array index on non-array', () => {
		const target = { items: 'not an array' };
		expect(() => set('items[0]', 'value', target)).toThrow(
			'Cannot set array index "0" on non-array'
		);
	});

	it('should handle multiple array indices in path', () => {
		const result = set('matrix[1][2]', 'value');
		expect(result).toEqual({
			matrix: [undefined, [undefined, undefined, 'value']]
		});
	});

	it('should handle array of objects with nested arrays', () => {
		const result = set('users[0].permissions[1].action', 'read');
		expect(result).toEqual({
			users: [
				{
					permissions: [undefined, { action: 'read' }]
				}
			]
		});
	});
});
