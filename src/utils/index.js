import { redis } from "../app.js";

export const isNotEmptyObject = (obj) => {
    return obj && Object.keys(obj).length > 0;
};

// Define a function to scan and delete matching keys
export async function scanAndDelete(pattern) {
    let cursor = '0';
    do {
        const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = nextCursor;

        if (keys.length > 0) {
            await redis.del(keys);
        }
    } while (cursor !== '0');
}