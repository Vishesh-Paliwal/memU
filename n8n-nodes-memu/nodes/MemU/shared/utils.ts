import { INodeExecutionData } from 'n8n-workflow';

/**
 * Utility functions for MemU node operations
 */

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

// ===== Utility Functions =====

/**
 * Sleep utility for retry logic
 */
export function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

// ===== Advanced Data Transformation Utilities =====

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
 * Clean and normalize text input
 */
export function normalizeTextInput(text: string): string {
	return text
		.trim()
		.replace(/\s+/g, ' ') // Replace multiple whitespace with single space
		.replace(/[\r\n]+/g, '\n'); // Normalize line endings
}