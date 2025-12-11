// services/shared/middleware/idempotency.js
// Idempotency middleware for preventing duplicate API requests

const Redis = require('ioredis');
const crypto = require('crypto');

const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD,
    retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
    }
});

/**
 * Idempotency Middleware
 * 
 * Prevents duplicate processing of requests by caching responses
 * based on an Idempotency-Key header.
 * 
 * Usage:
 *   app.post('/invoices', idempotencyMiddleware(), handler);
 * 
 * Client must send: Idempotency-Key header (UUID recommended)
 * 
 * @param {Object} options - Configuration options
 * @param {number} options.ttl - Cache TTL in seconds (default: 86400 = 24h)
 * @param {string} options.headerName - Header name (default: 'Idempotency-Key')
 * @param {boolean} options.required - Require idempotency key (default: true)
 */
function idempotencyMiddleware(options = {}) {
    const {
        ttl = 86400, // 24 hours
        headerName = 'idempotency-key',
        required = true
    } = options;

    return async (req, res, next) => {
        // Only apply to mutating operations
        if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
            return next();
        }

        const idempotencyKey = req.headers[headerName.toLowerCase()];

        if (!idempotencyKey) {
            if (required) {
                return res.status(400).json({
                    success: false,
                    error: `Missing required header: ${headerName}`,
                    code: 'IDEMPOTENCY_KEY_REQUIRED'
                });
            }
            return next();
        }

        // Validate key format (should be UUID or similar)
        if (!/^[a-f0-9-]{36}$/i.test(idempotencyKey)) {
            return res.status(400).json({
                success: false,
                error: 'Idempotency-Key must be a valid UUID',
                code: 'INVALID_IDEMPOTENCY_KEY'
            });
        }

        const cacheKey = `idempotency:${req.method}:${req.path}:${idempotencyKey}`;
        const lockKey = `${cacheKey}:lock`;

        try {
            // Check if we have a cached response
            const cachedResponse = await redis.get(cacheKey);

            if (cachedResponse) {
                const { statusCode, body, headers } = JSON.parse(cachedResponse);

                // Set cached headers
                Object.entries(headers).forEach(([key, value]) => {
                    res.setHeader(key, value);
                });

                res.setHeader('X-Idempotent-Replayed', 'true');

                return res.status(statusCode).json(body);
            }

            // Acquire distributed lock to prevent concurrent processing
            const lockAcquired = await redis.set(
                lockKey,
                '1',
                'EX', 10, // 10 second lock timeout
                'NX'     // Only set if not exists
            );

            if (!lockAcquired) {
                // Another request with same key is processing
                return res.status(409).json({
                    success: false,
                    error: 'Request with this Idempotency-Key is already being processed',
                    code: 'CONCURRENT_REQUEST',
                    retryAfter: 5
                });
            }

            // Store original res.json to intercept response
            const originalJson = res.json.bind(res);

            res.json = function (body) {
                // Cache the response
                const responseToCache = {
                    statusCode: res.statusCode,
                    body: body,
                    headers: {
                        'content-type': res.getHeader('content-type') || 'application/json'
                    }
                };

                // Only cache successful responses (2xx)
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    redis.setex(cacheKey, ttl, JSON.stringify(responseToCache))
                        .catch(err => console.error('Failed to cache idempotent response:', err));
                }

                // Release lock
                redis.del(lockKey).catch(err => console.error('Failed to release lock:', err));

                return originalJson(body);
            };

            // Handle errors and release lock
            res.on('finish', () => {
                if (res.statusCode >= 400) {
                    redis.del(lockKey).catch(err => console.error('Failed to release lock on error:', err));
                }
            });

            next();

        } catch (error) {
            console.error('Idempotency middleware error:', error);

            // Release lock on error
            redis.del(lockKey).catch(() => { });

            return res.status(500).json({
                success: false,
                error: 'Internal server error in idempotency check',
                code: 'IDEMPOTENCY_ERROR'
            });
        }
    };
}

/**
 * Invalidate cached idempotent response
 * Use when you need to force reprocessing (e.g., after manual intervention)
 */
async function invalidateIdempotencyKey(method, path, idempotencyKey) {
    const cacheKey = `idempotency:${method}:${path}:${idempotencyKey}`;
    await redis.del(cacheKey);
}

/**
 * Health check for Redis connection
 */
async function healthCheck() {
    try {
        await redis.ping();
        return { status: 'UP', redis: 'connected' };
    } catch (error) {
        return { status: 'DOWN', redis: 'disconnected', error: error.message };
    }
}

module.exports = {
    idempotencyMiddleware,
    invalidateIdempotencyKey,
    healthCheck
};
