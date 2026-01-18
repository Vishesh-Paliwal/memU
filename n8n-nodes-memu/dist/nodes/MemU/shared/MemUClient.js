"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemUClient = void 0;
const axios_1 = __importDefault(require("axios"));
const utils_1 = require("./utils");
class MemUClient {
    constructor(credentials, config) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        this.baseUrl = credentials.baseUrl;
        this.apiKey = credentials.apiKey;
        this.retryConfig = {
            maxRetries: (_b = (_a = config === null || config === void 0 ? void 0 : config.retryConfig) === null || _a === void 0 ? void 0 : _a.maxRetries) !== null && _b !== void 0 ? _b : 3,
            baseDelay: (_d = (_c = config === null || config === void 0 ? void 0 : config.retryConfig) === null || _c === void 0 ? void 0 : _c.baseDelay) !== null && _d !== void 0 ? _d : 1000,
            maxDelay: (_f = (_e = config === null || config === void 0 ? void 0 : config.retryConfig) === null || _e === void 0 ? void 0 : _e.maxDelay) !== null && _f !== void 0 ? _f : 10000,
            retryCondition: (_h = (_g = config === null || config === void 0 ? void 0 : config.retryConfig) === null || _g === void 0 ? void 0 : _g.retryCondition) !== null && _h !== void 0 ? _h : this.shouldRetry.bind(this),
        };
        this.httpClient = this.createHttpClient(config === null || config === void 0 ? void 0 : config.timeout);
    }
    async memorize(params) {
        return this.withRetry(async () => {
            const endpoint = '/api/v3/memory/memorize';
            const payload = {
                conversation: params.conversation,
                user_id: params.user_id,
                agent_id: params.agent_id,
            };
            if (params.user_name)
                payload.user_name = params.user_name;
            if (params.agent_name)
                payload.agent_name = params.agent_name;
            if (params.session_date)
                payload.session_date = params.session_date;
            const response = await this.httpClient.post(endpoint, payload);
            return response.data;
        });
    }
    async getTaskStatus(taskId) {
        return this.withRetry(async () => {
            const response = await this.httpClient.get(`/api/v3/memory/memorize/status/${taskId}`);
            return response.data;
        });
    }
    async waitForTaskCompletion(taskId, timeoutMs = 120000) {
        const startTime = Date.now();
        const pollInterval = 5000;
        while (Date.now() - startTime < timeoutMs) {
            const status = await this.getTaskStatus(taskId);
            if (status.status === 'SUCCESS' || status.status === 'FAILED') {
                return status;
            }
            await (0, utils_1.sleep)(pollInterval);
        }
        throw new Error(`Task ${taskId} did not complete within ${timeoutMs}ms timeout`);
    }
    async retrieve(params) {
        return this.withRetry(async () => {
            const endpoint = '/api/v3/memory/retrieve';
            const payload = {
                user_id: params.user_id,
                agent_id: params.agent_id,
                query: params.query,
            };
            const response = await this.httpClient.post(endpoint, payload);
            return response.data;
        });
    }
    async listCategories(params) {
        return this.withRetry(async () => {
            const response = await this.httpClient.post('/api/v3/memory/categories', { user_id: params.user_id, agent_id: params.agent_id });
            return response.data;
        });
    }
    async withRetry(operation, maxRetries, baseDelay) {
        const retries = maxRetries !== null && maxRetries !== void 0 ? maxRetries : this.retryConfig.maxRetries;
        const delay = baseDelay !== null && baseDelay !== void 0 ? baseDelay : this.retryConfig.baseDelay;
        let lastError;
        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                return await operation();
            }
            catch (error) {
                lastError = error;
                if (attempt === retries) {
                    throw this.handleApiError(error);
                }
                if (this.retryConfig.retryCondition(error)) {
                    const backoffDelay = Math.min(delay * Math.pow(2, attempt), this.retryConfig.maxDelay);
                    await (0, utils_1.sleep)(backoffDelay);
                }
                else {
                    throw this.handleApiError(error);
                }
            }
        }
        throw this.handleApiError(lastError);
    }
    async testConnection() {
        try {
            await this.httpClient.get('/');
            return true;
        }
        catch {
            return false;
        }
    }
    createHttpClient(timeout) {
        const client = axios_1.default.create({
            baseURL: this.baseUrl,
            timeout: timeout !== null && timeout !== void 0 ? timeout : 30000,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'n8n-memu-adapter/1.0.0',
            },
        });
        if (this.apiKey) {
            client.defaults.headers.common['Authorization'] = `Bearer ${this.apiKey}`;
        }
        client.interceptors.request.use((config) => {
            if (this.apiKey && !config.headers['Authorization']) {
                config.headers['Authorization'] = `Bearer ${this.apiKey}`;
            }
            return config;
        }, (error) => Promise.reject(error));
        return client;
    }
    handleApiError(error) {
        if (error.response) {
            const status = error.response.status;
            const data = error.response.data;
            const message = (data === null || data === void 0 ? void 0 : data.message) || (data === null || data === void 0 ? void 0 : data.detail) || error.message;
            switch (status) {
                case 401: return new Error('Authentication failed. Please check your API credentials.');
                case 403: return new Error('Access denied. Insufficient permissions.');
                case 422: return new Error(`Validation error: ${JSON.stringify((data === null || data === void 0 ? void 0 : data.detail) || message)}`);
                case 429: return new Error('Rate limit exceeded. Please try again later.');
                case 404: return new Error('Resource not found.');
                case 500: return new Error('MemU service error. Please try again later.');
                default: return new Error(`API Error (${status}): ${message}`);
            }
        }
        else if (error.request) {
            return new Error('Network error. Please check your connection.');
        }
        return new Error(`Unexpected error: ${error.message}`);
    }
    shouldRetry(error) {
        return !error.response || (error.response.status >= 500 && error.response.status < 600);
    }
}
exports.MemUClient = MemUClient;
