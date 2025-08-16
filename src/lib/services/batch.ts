type Run<T> = (offset: number, limit: number) => Promise<T[]>;

/**
 * Runs the execute function in batches of batchSize, yielding the results as a generator.
 * For use in DB Queries where you want to process a large number of results in batches, but
 * don't want to load all results into memory at once. the batchSize is the number of results
 * to fetch in each batch. When a result has less than the batchSize, it is the last batch.If the result is 0 it will also
 * stop.
 *
 * Be sure to include the offset in the db query otherwise the same query will run again and
 * you will get duplicate results, and it will never finish.  Also the results should be sorted.
 *
 * @param execute function that returns a batch of results
 * @param batchSize size of each batch
 * @returns
 */
export async function* batchToGenerator<T>(execute: Run<T>, batchSize: number) {
	let offset = 0;
	let length = 0;
	do {
		const result = await execute(offset, batchSize);
		length = result?.length ?? 0;
		if (length === 0) return;
		offset += length;
		yield* result;
	} while (length === batchSize);
}
