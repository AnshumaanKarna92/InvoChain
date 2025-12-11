// services/shared/resilience/circuit-breaker.js
// Circuit breaker pattern implementation using opossum

const CircuitBreaker = require('opossum');
const axios = require('axios');

/**
 * Create a circuit breaker for HTTP service calls
 * 
 * @param {string} serviceName - Name of the service (for metrics)
 * @param {Object} options - Circuit breaker options
 * @returns {CircuitBreaker} - Configured circuit breaker instance
 */
function createServiceCircuitBreaker(serviceName, options = {}) {
    const defaultOptions = {
        timeout: 3000,              // Timeout after 3s
        errorThresholdPercentage: 50, // Open if 50% of requests fail
        resetTimeout: 30000,        // Try again after 30s
        rollingCountTimeout: 10000, // 10s rolling window
        rollingCountBuckets: 10,    // 10 buckets
        name: serviceName,
        volumeThreshold: 10,        // Minimum requests before opening
        ...options
    };

    const breaker = new CircuitBreaker(async (requestConfig) => {
        return await axios(requestConfig);
    }, defaultOptions);

    // Event listeners for monitoring
    breaker.on('open', () => {
        console.warn(`[CircuitBreaker] ${serviceName} circuit opened - service is failing`);
        // Increment Prometheus metric
        if (global.metrics) {
            global.metrics.circuitBreakerState.set({ service: serviceName }, 1); // 1 = OPEN
        }
    });

    breaker.on('halfOpen', () => {
        console.info(`[CircuitBreaker] ${serviceName} circuit half-open - testing service`);
        if (global.metrics) {
            global.metrics.circuitBreakerState.set({ service: serviceName }, 2); // 2 = HALF_OPEN
        }
    });

    breaker.on('close', () => {
        console.info(`[CircuitBreaker] ${serviceName} circuit closed - service recovered`);
        if (global.metrics) {
            global.metrics.circuitBreakerState.set({ service: serviceName }, 0); // 0 = CLOSED
        }
    });

    breaker.on('failure', (error) => {
        console.error(`[CircuitBreaker] ${serviceName} request failed:`, error.message);
    });

    breaker.on('timeout', () => {
        console.warn(`[CircuitBreaker] ${serviceName} request timed out`);
    });

    breaker.on('fallback', (result) => {
        console.info(`[CircuitBreaker] ${serviceName} fallback executed`);
    });

    return breaker;
}

/**
 * Retry wrapper with exponential backoff
 * 
 * @param {Function} fn - Async function to retry
 * @param {Object} options - Retry options
 * @returns {Promise} - Result of function or throws error
 */
async function retryWithBackoff(fn, options = {}) {
    const {
        retries = 3,
        factor = 2,
        minTimeout = 1000,
        maxTimeout = 10000,
        randomize = true,
        retryableErrors = ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND'],
        retryableStatusCodes = [408, 429, 500, 502, 503, 504]
    } = options;

    let lastError;

    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            // Check if error is retryable
            const isRetryableError = retryableErrors.includes(error.code);
            const isRetryableStatus = error.response && retryableStatusCodes.includes(error.response.status);

            if (!isRetryableError && !isRetryableStatus) {
                throw error; // Don't retry non-retryable errors
            }

            if (attempt === retries) {
                throw error; // Max retries reached
            }

            // Calculate backoff delay
            let delay = Math.min(minTimeout * Math.pow(factor, attempt), maxTimeout);

            if (randomize) {
                delay = delay * (0.5 + Math.random() * 0.5); // Add jitter
            }

            console.warn(`[Retry] Attempt ${attempt + 1}/${retries} failed, retrying in ${Math.round(delay)}ms...`, {
                error: error.message,
                code: error.code,
                status: error.response?.status
            });

            await sleep(delay);
        }
    }

    throw lastError;
}

/**
 * Bulkhead pattern: Limit concurrent requests to a service
 */
class Bulkhead {
    constructor(maxConcurrent = 10, maxQueue = 100) {
        this.maxConcurrent = maxConcurrent;
        this.maxQueue = maxQueue;
        this.running = 0;
        this.queue = [];
    }

    async execute(fn) {
        if (this.running >= this.maxConcurrent) {
            if (this.queue.length >= this.maxQueue) {
                throw new Error('Bulkhead queue full - rejecting request');
            }

            // Wait in queue
            await new Promise((resolve, reject) => {
                this.queue.push({ resolve, reject });
            });
        }

        this.running++;

        try {
            return await fn();
        } finally {
            this.running--;

            // Process next in queue
            if (this.queue.length > 0) {
                const { resolve } = this.queue.shift();
                resolve();
            }
        }
    }

    getStats() {
        return {
            running: this.running,
            queued: this.queue.length,
            capacity: this.maxConcurrent,
            queueCapacity: this.maxQueue
        };
    }
}

/**
 * Timeout wrapper
 */
async function withTimeout(promise, timeoutMs, errorMessage = 'Operation timed out') {
    return Promise.race([
        promise,
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
        )
    ]);
}

/**
 * Sleep utility
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Example: Create circuit breakers for all services
 */
function createServiceBreakers() {
    return {
        inventoryService: createServiceCircuitBreaker('inventory-service', {
            timeout: 5000,
            errorThresholdPercentage: 50,
            fallback: () => ({
                success: false,
                error: 'Inventory service unavailable',
                fallback: true
            })
        }),

        auditService: createServiceCircuitBreaker('audit-service', {
            timeout: 3000,
            errorThresholdPercentage: 60,
            fallback: () => ({
                success: false,
                error: 'Audit service unavailable - logged to DLQ',
                fallback: true
            })
        }),

        gstService: createServiceCircuitBreaker('gst-service', {
            timeout: 10000, // GST API can be slow
            errorThresholdPercentage: 40
        }),

        paymentService: createServiceCircuitBreaker('payment-service', {
            timeout: 5000,
            errorThresholdPercentage: 50
        })
    };
}

module.exports = {
    createServiceCircuitBreaker,
    retryWithBackoff,
    Bulkhead,
    withTimeout,
    sleep,
    createServiceBreakers
};
