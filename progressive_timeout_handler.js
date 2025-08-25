class ProgressiveTimeoutHandler {
    constructor() {
        this.maxRetries = 3;
        this.baseTimeout = 30000; // 30秒基础超时
        this.timeoutMultiplier = 1.5;
    }

    async withTimeout(promise, timeout = this.baseTimeout, retryCount = 0) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error(`Operation timed out after ${timeout}ms`));
            }, timeout);

            promise
                .then(result => {
                    clearTimeout(timer);
                    resolve(result);
                })
                .catch(error => {
                    clearTimeout(timer);
                    reject(error);
                });
        });
    }

    async executeWithRetry(operation, options = {}) {
        const { maxRetries = this.maxRetries, initialTimeout = this.baseTimeout } = options;
        let lastError;
        
        for (let i = 0; i <= maxRetries; i++) {
            try {
                const timeout = initialTimeout * Math.pow(this.timeoutMultiplier, i);
                console.log(`尝试 ${i + 1}/${maxRetries + 1}，超时设置: ${timeout}ms`);
                
                const result = await this.withTimeout(operation(), timeout, i);
                return result;
            } catch (error) {
                lastError = error;
                console.log(`尝试 ${i + 1} 失败:`, error.message);
                
                if (i < maxRetries) {
                    const delay = Math.min(1000 * Math.pow(2, i), 10000);
                    console.log(`等待 ${delay}ms 后重试...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        
        throw lastError;
    }

    calculateTimeout(retryCount) {
        return this.baseTimeout * Math.pow(this.timeoutMultiplier, retryCount);
    }
}

module.exports = ProgressiveTimeoutHandler;