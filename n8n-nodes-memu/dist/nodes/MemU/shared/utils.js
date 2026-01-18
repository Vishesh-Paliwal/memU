"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeTextInput = exports.batchProcessInputData = exports.transformMemUResponse = exports.sleep = exports.handleMemUError = exports.createErrorOutput = void 0;
/**
 * Utility functions for MemU node operations
 */
// ===== Error Handling Utilities =====
/**
 * Create error output for n8n with proper formatting
 */
function createErrorOutput(message, originalData, errorCode) {
    return {
        json: {
            ...originalData,
            error: true,
            error_code: errorCode || 'UNKNOWN_ERROR',
            message,
            timestamp: new Date().toISOString(),
        },
    };
}
exports.createErrorOutput = createErrorOutput;
/**
 * Handle MemU API errors with proper n8n formatting
 */
function handleMemUError(error, originalData) {
    var _a;
    if (error.response) {
        // API responded with error status
        const status = error.response.status;
        const message = ((_a = error.response.data) === null || _a === void 0 ? void 0 : _a.message) || error.message;
        switch (status) {
            case 401:
                return createErrorOutput('Authentication failed. Please check your API credentials.', originalData, 'AUTH_FAILED');
            case 403:
                return createErrorOutput('Access denied. Insufficient permissions.', originalData, 'ACCESS_DENIED');
            case 429:
                return createErrorOutput('Rate limit exceeded. Please try again later.', originalData, 'RATE_LIMITED');
            case 404:
                return createErrorOutput('Resource not found. Please check the URL or ID.', originalData, 'NOT_FOUND');
            case 422:
                return createErrorOutput(`Validation error: ${message}`, originalData, 'VALIDATION_ERROR');
            case 500:
                return createErrorOutput('MemU service error. Please try again later.', originalData, 'SERVICE_ERROR');
            default:
                return createErrorOutput(`API Error (${status}): ${message}`, originalData, 'API_ERROR');
        }
    }
    else if (error.request) {
        // Network error
        return createErrorOutput('Network error. Please check your connection and MemU service URL.', originalData, 'NETWORK_ERROR');
    }
    else {
        // Other errors
        return createErrorOutput(`Unexpected error: ${error.message}`, originalData, 'UNEXPECTED_ERROR');
    }
}
exports.handleMemUError = handleMemUError;
// ===== Utility Functions =====
/**
 * Sleep utility for retry logic
 */
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
exports.sleep = sleep;
// ===== Advanced Data Transformation Utilities =====
/**
 * Transform MemU response to n8n standard format with metadata
 */
function transformMemUResponse(response, operation, originalData) {
    var _a, _b, _c, _d, _e;
    const baseOutput = {
        operation,
        timestamp: new Date().toISOString(),
        success: true,
    };
    // Handle different response types
    if (operation === 'memorize') {
        return {
            json: {
                ...originalData,
                memu: {
                    ...baseOutput,
                    resource: response.resource,
                    resources: response.resources,
                    items_count: ((_a = response.items) === null || _a === void 0 ? void 0 : _a.length) || 0,
                    categories_count: ((_b = response.categories) === null || _b === void 0 ? void 0 : _b.length) || 0,
                    items: response.items,
                    categories: response.categories,
                    relations: response.relations,
                },
            },
        };
    }
    else if (operation === 'retrieve') {
        return {
            json: {
                ...originalData,
                memu: {
                    ...baseOutput,
                    needs_retrieval: response.needs_retrieval,
                    original_query: response.original_query,
                    rewritten_query: response.rewritten_query,
                    next_step_query: response.next_step_query,
                    results_count: {
                        categories: ((_c = response.categories) === null || _c === void 0 ? void 0 : _c.length) || 0,
                        items: ((_d = response.items) === null || _d === void 0 ? void 0 : _d.length) || 0,
                        resources: ((_e = response.resources) === null || _e === void 0 ? void 0 : _e.length) || 0,
                    },
                    categories: response.categories,
                    items: response.items,
                    resources: response.resources,
                },
            },
        };
    }
    else if (operation === 'list') {
        return {
            json: {
                ...originalData,
                memu: {
                    ...baseOutput,
                    total_count: response.total_count,
                    items: response.items,
                    categories: response.categories,
                },
            },
        };
    }
    else {
        // Generic operation response
        return {
            json: {
                ...originalData,
                memu: {
                    ...baseOutput,
                    result: response,
                },
            },
        };
    }
}
exports.transformMemUResponse = transformMemUResponse;
/**
 * Batch process input data with error handling
 */
async function batchProcessInputData(inputData, processor, options = {}) {
    const { preserveOrder = true, continueOnError = true, maxConcurrency = 5 } = options;
    const processItem = async (item, index) => {
        try {
            const result = await processor(item, index);
            return {
                success: true,
                result,
                originalData: item.json,
                index,
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (!continueOnError) {
                throw error;
            }
            return {
                success: false,
                error: errorMessage,
                originalData: item.json,
                index,
            };
        }
    };
    if (maxConcurrency === 1 || preserveOrder) {
        // Sequential processing
        return await Promise.all(inputData.map(processItem));
    }
    else {
        // Concurrent processing with limit
        const chunks = [];
        for (let i = 0; i < inputData.length; i += maxConcurrency) {
            chunks.push(inputData.slice(i, i + maxConcurrency));
        }
        const results = [];
        for (const chunk of chunks) {
            const chunkResults = await Promise.all(chunk.map((item, chunkIndex) => processItem(item, results.length + chunkIndex)));
            results.push(...chunkResults);
        }
        return results;
    }
}
exports.batchProcessInputData = batchProcessInputData;
/**
 * Clean and normalize text input
 */
function normalizeTextInput(text) {
    return text
        .trim()
        .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
        .replace(/[\r\n]+/g, '\n'); // Normalize line endings
}
exports.normalizeTextInput = normalizeTextInput;
