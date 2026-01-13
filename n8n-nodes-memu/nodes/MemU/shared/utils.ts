import { INodeExecutionData } from 'n8n-workflow';
import { ValidationResult, InputValidationError, MemUError } from './types';

/**
 * Utility functions for MemU node operations
 */

// ===== Data Extraction Utilities =====

/**
 * Extract URLs from n8n input data
 */
export function extractUrlFromInput(
	inputData: INodeExecutionData[],
	urlField: string = 'url',
): string[] {
	return inputData
		.map((item) => {
			const url = item.json[urlField];
			return typeof url === 'string' ? url : null;
		})
		.filter((url): url is string => url !== null);
}

/**
 * Extract queries from n8n input data
 */
export function extractQueryFromInput(
	inputData: INodeExecutionData[],
	queryField: string = 'query',
): string[] {
	return inputData
		.map((item) => {
			const query = item.json[queryField];
			return typeof query === 'string' ? query : null;
		})
		.filter((query): query is string => query !== null);
}

// ===== Output Formatting Utilities =====

/**
 * Format output for n8n standard item structure
 */
export function formatMemUOutput(
	originalData: any,
	memUResult: any,
	operation: string,
): INodeExecutionData {
	return {
		json: {
			...originalData,
			memu: {
				operation,
				result: memUResult,
				timestamp: new Date().toISOString(),
			},
		},
	};
}

/**
 * Preserve original data alongside MemU results
 */
export function preserveOriginalData(
	originalItem: INodeExecutionData,
	memUData: any,
): INodeExecutionData {
	return {
		json: {
			...originalItem.json,
			memu_result: memUData,
		},
		binary: originalItem.binary,
	};
}

// ===== Validation Utilities =====

/**
 * Validate URL format
 */
export function isValidUrl(url: string): boolean {
	try {
		new URL(url);
		return true;
	} catch {
		return false;
	}
}

/**
 * Validate modality value
 */
export function isValidModality(modality: string): boolean {
	const validModalities = ['conversation', 'document', 'image', 'video', 'audio'];
	return validModalities.includes(modality);
}

/**
 * Validate memory type
 */
export function isValidMemoryType(memoryType: string): boolean {
	const validTypes = ['behavior', 'event', 'knowledge', 'profile', 'skill'];
	return validTypes.includes(memoryType);
}

/**
 * Validate retrieval method
 */
export function isValidRetrievalMethod(method: string): boolean {
	const validMethods = ['rag', 'llm'];
	return validMethods.includes(method);
}

/**
 * Comprehensive input parameter validation
 */
export function validateInputParameters(params: Record<string, any>): ValidationResult {
	const errors: string[] = [];

	// Validate resource URL if present
	if (params.resourceUrl && !isValidUrl(params.resourceUrl)) {
		errors.push(`Invalid resource URL: ${params.resourceUrl}`);
	}

	// Validate modality if present
	if (params.modality && !isValidModality(params.modality)) {
		errors.push(`Invalid modality: ${params.modality}. Must be one of: conversation, document, image, video, audio`);
	}

	// Validate memory type if present
	if (params.memoryType && !isValidMemoryType(params.memoryType)) {
		errors.push(`Invalid memory type: ${params.memoryType}. Must be one of: behavior, event, knowledge, profile, skill`);
	}

	// Validate retrieval method if present
	if (params.method && !isValidRetrievalMethod(params.method)) {
		errors.push(`Invalid retrieval method: ${params.method}. Must be one of: rag, llm`);
	}

	// Validate required fields
	if (params.operation === 'memorize' && !params.resourceUrl) {
		errors.push('Resource URL is required for memorize operation');
	}

	if (params.operation === 'retrieve' && !params.query && !params.queries) {
		errors.push('Query is required for retrieve operation');
	}

	return {
		isValid: errors.length === 0,
		errors,
	};
}

/**
 * Validate individual field with detailed error information
 */
export function validateField(fieldName: string, value: any, rules: string[]): InputValidationError | null {
	for (const rule of rules) {
		switch (rule) {
			case 'required':
				if (value === undefined || value === null || value === '') {
					return {
						field: fieldName,
						message: `${fieldName} is required`,
						value,
					};
				}
				break;
			case 'url':
				if (value && !isValidUrl(value)) {
					return {
						field: fieldName,
						message: `${fieldName} must be a valid URL`,
						value,
					};
				}
				break;
			case 'modality':
				if (value && !isValidModality(value)) {
					return {
						field: fieldName,
						message: `${fieldName} must be one of: conversation, document, image, video, audio`,
						value,
					};
				}
				break;
			case 'memoryType':
				if (value && !isValidMemoryType(value)) {
					return {
						field: fieldName,
						message: `${fieldName} must be one of: behavior, event, knowledge, profile, skill`,
						value,
					};
				}
				break;
		}
	}
	return null;
}

// ===== Error Handling Utilities =====

/**
 * Create error output for n8n with proper formatting
 */
export function createErrorOutput(message: string, originalData?: any, errorCode?: string): INodeExecutionData {
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

/**
 * Create validation error output
 */
export function createValidationErrorOutput(errors: string[], originalData?: any): INodeExecutionData {
	return {
		json: {
			...originalData,
			error: true,
			error_code: 'VALIDATION_ERROR',
			message: 'Input validation failed',
			validation_errors: errors,
			timestamp: new Date().toISOString(),
		},
	};
}

/**
 * Handle MemU API errors with proper n8n formatting
 */
export function handleMemUError(error: any, originalData?: any): INodeExecutionData {
	if (error.response) {
		// API responded with error status
		const status = error.response.status;
		const message = error.response.data?.message || error.message;
		
		switch (status) {
			case 401:
				return createErrorOutput(
					'Authentication failed. Please check your API credentials.',
					originalData,
					'AUTH_FAILED'
				);
			case 403:
				return createErrorOutput(
					'Access denied. Insufficient permissions.',
					originalData,
					'ACCESS_DENIED'
				);
			case 429:
				return createErrorOutput(
					'Rate limit exceeded. Please try again later.',
					originalData,
					'RATE_LIMITED'
				);
			case 404:
				return createErrorOutput(
					'Resource not found. Please check the URL or ID.',
					originalData,
					'NOT_FOUND'
				);
			case 422:
				return createErrorOutput(
					`Validation error: ${message}`,
					originalData,
					'VALIDATION_ERROR'
				);
			case 500:
				return createErrorOutput(
					'MemU service error. Please try again later.',
					originalData,
					'SERVICE_ERROR'
				);
			default:
				return createErrorOutput(
					`API Error (${status}): ${message}`,
					originalData,
					'API_ERROR'
				);
		}
	} else if (error.request) {
		// Network error
		return createErrorOutput(
			'Network error. Please check your connection and MemU service URL.',
			originalData,
			'NETWORK_ERROR'
		);
	} else {
		// Other errors
		return createErrorOutput(
			`Unexpected error: ${error.message}`,
			originalData,
			'UNEXPECTED_ERROR'
		);
	}
}

/**
 * Determine if an error should trigger retry logic
 */
export function shouldRetryError(error: any): boolean {
	// Retry on network errors and 5xx server errors
	if (!error.response) {
		return true; // Network errors
	}
	
	const status = error.response.status;
	return status >= 500 && status < 600; // Server errors
}

/**
 * Calculate exponential backoff delay with jitter
 */
export function calculateBackoffDelay(attempt: number, baseDelay: number = 1000, maxDelay: number = 10000): number {
	const exponentialDelay = baseDelay * Math.pow(2, attempt);
	const jitter = Math.random() * 0.1 * exponentialDelay; // Add 10% jitter
	return Math.min(exponentialDelay + jitter, maxDelay);
}

// ===== Utility Functions =====

/**
 * Sleep utility for retry logic
 */
export function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Sanitize error messages to prevent information leakage
 */
export function sanitizeErrorMessage(message: string): string {
	// Remove sensitive information patterns
	return message
		.replace(/api[_-]?key[s]?[:\s=]+[^\s]+/gi, 'api_key=***')
		.replace(/token[s]?[:\s=]+[^\s]+/gi, 'token=***')
		.replace(/password[s]?[:\s=]+[^\s]+/gi, 'password=***')
		.replace(/secret[s]?[:\s=]+[^\s]+/gi, 'secret=***');
}

/**
 * Create a timeout promise for operations
 */
export function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
	const timeoutPromise = new Promise<never>((_, reject) => {
		setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs);
	});

	return Promise.race([promise, timeoutPromise]);
}

// ===== Advanced Data Transformation Utilities =====

/**
 * Extract multiple field values from n8n input data
 */
export function extractFieldsFromInput(
	inputData: INodeExecutionData[],
	fieldMappings: Record<string, string>,
): Record<string, any>[] {
	return inputData.map((item) => {
		const extracted: Record<string, any> = {};
		Object.entries(fieldMappings).forEach(([targetField, sourceField]) => {
			extracted[targetField] = item.json[sourceField];
		});
		return extracted;
	});
}

/**
 * Transform MemU response to n8n standard format with metadata
 */
export function transformMemUResponse(
	response: any,
	operation: string,
	originalData?: any,
): INodeExecutionData {
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
					items_count: response.items?.length || 0,
					categories_count: response.categories?.length || 0,
					items: response.items,
					categories: response.categories,
					relations: response.relations,
				},
			},
		};
	} else if (operation === 'retrieve') {
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
						categories: response.categories?.length || 0,
						items: response.items?.length || 0,
						resources: response.resources?.length || 0,
					},
					categories: response.categories,
					items: response.items,
					resources: response.resources,
				},
			},
		};
	} else if (operation === 'list') {
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
	} else {
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

/**
 * Batch process input data with error handling
 */
export async function batchProcessInputData<T, R>(
	inputData: INodeExecutionData[],
	processor: (item: INodeExecutionData, index: number) => Promise<R>,
	options: {
		preserveOrder?: boolean;
		continueOnError?: boolean;
		maxConcurrency?: number;
	} = {},
): Promise<Array<{ success: boolean; result?: R; error?: string; originalData: any; index: number }>> {
	const { preserveOrder = true, continueOnError = true, maxConcurrency = 5 } = options;

	const processItem = async (item: INodeExecutionData, index: number) => {
		try {
			const result = await processor(item, index);
			return {
				success: true,
				result,
				originalData: item.json,
				index,
			};
		} catch (error) {
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
	} else {
		// Concurrent processing with limit
		const chunks: INodeExecutionData[][] = [];
		for (let i = 0; i < inputData.length; i += maxConcurrency) {
			chunks.push(inputData.slice(i, i + maxConcurrency));
		}

		const results: Array<{ success: boolean; result?: R; error?: string; originalData: any; index: number }> = [];
		for (const chunk of chunks) {
			const chunkResults = await Promise.all(
				chunk.map((item, chunkIndex) => processItem(item, results.length + chunkIndex))
			);
			results.push(...chunkResults);
		}

		return results;
	}
}

/**
 * Merge multiple MemU results into a single output
 */
export function mergeMemUResults(
	results: any[],
	operation: string,
): INodeExecutionData {
	const merged = {
		operation,
		timestamp: new Date().toISOString(),
		batch_size: results.length,
		successful_operations: results.filter(r => r.success).length,
		failed_operations: results.filter(r => !r.success).length,
	};

	if (operation === 'memorize') {
		const allItems: any[] = [];
		const allCategories: any[] = [];
		const allResources: any[] = [];

		results.forEach(result => {
			if (result.success && result.result) {
				if (result.result.items) allItems.push(...result.result.items);
				if (result.result.categories) allCategories.push(...result.result.categories);
				if (result.result.resources) allResources.push(...result.result.resources);
			}
		});

		return {
			json: {
				memu: {
					...merged,
					total_items: allItems.length,
					total_categories: allCategories.length,
					total_resources: allResources.length,
					items: allItems,
					categories: allCategories,
					resources: allResources,
					individual_results: results,
				},
			},
		};
	} else {
		return {
			json: {
				memu: {
					...merged,
					results,
				},
			},
		};
	}
}

/**
 * Extract user context from n8n input data
 */
export function extractUserContext(
	inputData: INodeExecutionData,
	userScopingConfig?: Record<string, any>,
): Record<string, any> | undefined {
	if (!userScopingConfig) return undefined;

	const userContext: Record<string, any> = {};
	let hasContext = false;

	Object.entries(userScopingConfig).forEach(([key, fieldName]) => {
		if (fieldName && inputData.json[fieldName]) {
			userContext[key] = inputData.json[fieldName];
			hasContext = true;
		}
	});

	return hasContext ? userContext : undefined;
}

/**
 * Format context messages for MemU API
 */
export function formatContextMessages(
	messages: Array<{ role: string; content: string }>,
): Array<{ role: string; content: { text: string } }> {
	return messages.map(msg => ({
		role: msg.role,
		content: {
			text: msg.content,
		},
	}));
}

/**
 * Clean and normalize text input
 */
export function normalizeTextInput(text: string): string {
	return text
		.trim()
		.replace(/\s+/g, ' ') // Replace multiple whitespace with single space
		.replace(/[\r\n]+/g, '\n'); // Normalize line endings
}