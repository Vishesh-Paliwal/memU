import { INodeExecutionData } from 'n8n-workflow';

/**
 * Utility functions for MemU node operations
 */

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
 * Create error output for n8n
 */
export function createErrorOutput(message: string, originalData?: any): INodeExecutionData {
	return {
		json: {
			...originalData,
			error: true,
			message,
			timestamp: new Date().toISOString(),
		},
	};
}

/**
 * Sleep utility for retry logic
 */
export function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}