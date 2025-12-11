// services/shared/locks/distributed-lock.js
// Distributed locking using Redis (Redlock algorithm)

const Redis = require('ioredis');
const crypto = require('crypto');

class DistributedLock {
    constructor(redisClients = []) {
        // Support multiple Redis instances for Redlock algorithm
        this.clients = redisClients.length > 0 ? redisClients : [
            new Redis({
                host: process.env.REDIS_HOST || 'localhost',
                port: process.env.REDIS_PORT || 6379,
                password: process.env.REDIS_PASSWORD
            })
        ];

        this.quorum = Math.floor(this.clients.length / 2) + 1;
        this.retryCount = 3;
        this.retryDelay = 200; // ms
        this.clockDriftFactor = 0.01;
    }

    /**
     * Acquire a distributed lock
     * 
     * @param {string} resource - Resource identifier (e.g., 'inventory:SKU123')
     * @param {number} ttl - Lock TTL in milliseconds (default: 5000)
     * @returns {Object|null} - Lock object or null if failed
     */
    async acquire(resource, ttl = 5000) {
        const lockKey = `lock:${resource}`;
        const lockValue = crypto.randomBytes(16).toString('hex');

        for (let attempt = 0; attempt < this.retryCount; attempt++) {
            const startTime = Date.now();
            let locksAcquired = 0;

            // Try to acquire lock on all Redis instances
            const lockPromises = this.clients.map(async (client) => {
                try {
                    const result = await client.set(
                        lockKey,
                        lockValue,
                        'PX', ttl,  // Expiry in milliseconds
                        'NX'        // Only set if not exists
                    );
                    return result === 'OK';
                } catch (error) {
                    console.error('Failed to acquire lock on Redis instance:', error);
                    return false;
                }
            });

            const results = await Promise.all(lockPromises);
            locksAcquired = results.filter(r => r === true).length;

            const elapsedTime = Date.now() - startTime;
            const drift = Math.floor(ttl * this.clockDriftFactor) + 2;
            const validityTime = ttl - elapsedTime - drift;

            // Check if we acquired quorum and lock is still valid
            if (locksAcquired >= this.quorum && validityTime > 0) {
                return {
                    resource: lockKey,
                    value: lockValue,
                    validity: validityTime,
                    acquiredAt: Date.now()
                };
            }

            // Failed to acquire quorum, release any acquired locks
            await this.release({ resource: lockKey, value: lockValue });

            // Wait before retry
            if (attempt < this.retryCount - 1) {
                await this.sleep(this.retryDelay * Math.pow(2, attempt));
            }
        }

        return null; // Failed to acquire lock
    }

    /**
     * Release a distributed lock
     * 
     * @param {Object} lock - Lock object from acquire()
     * @returns {boolean} - True if released successfully
     */
    async release(lock) {
        const { resource, value } = lock;

        // Lua script for atomic check-and-delete
        const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

        const releasePromises = this.clients.map(async (client) => {
            try {
                const result = await client.eval(script, 1, resource, value);
                return result === 1;
            } catch (error) {
                console.error('Failed to release lock on Redis instance:', error);
                return false;
            }
        });

        const results = await Promise.all(releasePromises);
        const releasedCount = results.filter(r => r === true).length;

        return releasedCount >= this.quorum;
    }

    /**
     * Execute function with lock
     * 
     * @param {string} resource - Resource to lock
     * @param {Function} fn - Async function to execute
     * @param {number} ttl - Lock TTL in milliseconds
     * @returns {any} - Result of function
     */
    async withLock(resource, fn, ttl = 5000) {
        const lock = await this.acquire(resource, ttl);

        if (!lock) {
            throw new Error(`Failed to acquire lock for resource: ${resource}`);
        }

        try {
            return await fn();
        } finally {
            await this.release(lock);
        }
    }

    /**
     * Extend lock TTL
     * 
     * @param {Object} lock - Lock object
     * @param {number} ttl - New TTL in milliseconds
     * @returns {boolean} - True if extended successfully
     */
    async extend(lock, ttl) {
        const { resource, value } = lock;

        const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("pexpire", KEYS[1], ARGV[2])
      else
        return 0
      end
    `;

        const extendPromises = this.clients.map(async (client) => {
            try {
                const result = await client.eval(script, 1, resource, value, ttl);
                return result === 1;
            } catch (error) {
                console.error('Failed to extend lock on Redis instance:', error);
                return false;
            }
        });

        const results = await Promise.all(extendPromises);
        const extendedCount = results.filter(r => r === true).length;

        return extendedCount >= this.quorum;
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

/**
 * Optimistic locking helper for database operations
 * 
 * @param {Object} client - Database client
 * @param {string} table - Table name
 * @param {string} id - Record ID
 * @param {Function} updateFn - Function that returns update values
 * @param {number} maxRetries - Maximum retry attempts
 * @returns {Object} - Updated record
 */
async function optimisticUpdate(client, table, id, updateFn, maxRetries = 3) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        // Read current version
        const result = await client.query(
            `SELECT * FROM ${table} WHERE id = $1`,
            [id]
        );

        if (result.rows.length === 0) {
            throw new Error(`Record not found: ${id}`);
        }

        const currentRecord = result.rows[0];
        const currentVersion = currentRecord.version || 0;

        // Calculate updates
        const updates = await updateFn(currentRecord);

        // Build SET clause
        const setClauses = Object.keys(updates)
            .map((key, i) => `${key} = $${i + 3}`)
            .join(', ');

        const values = Object.values(updates);

        // Attempt update with version check
        const updateResult = await client.query(
            `UPDATE ${table} 
       SET ${setClauses}, version = version + 1, updated_at = NOW()
       WHERE id = $1 AND version = $2
       RETURNING *`,
            [id, currentVersion, ...values]
        );

        if (updateResult.rows.length > 0) {
            return updateResult.rows[0]; // Success
        }

        // Version mismatch, retry
        console.warn(`Optimistic lock conflict on ${table}:${id}, attempt ${attempt + 1}/${maxRetries}`);

        if (attempt < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, attempt)));
        }
    }

    throw new Error(`Optimistic lock failed after ${maxRetries} attempts`);
}

module.exports = {
    DistributedLock,
    optimisticUpdate
};
