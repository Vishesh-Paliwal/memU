import { INodeExecutionData } from 'n8n-workflow';
/**
 * Utility functions for MemU node operations
 */
/**
 * Create error output for n8n with proper formatting
 */
export declare function createErrorOutput(message: string, originalData?: any, errorCode?: string): INodeExecutionData;
/**
 * Handle MemU API errors with proper n8n formatting
 */
export declare function handleMemUError(error: any, originalData?: any): INodeExecutionData;
/**
 * Sleep utility for retry logic
 */
export declare function sleep(ms: number): Promise<void>;
/**
 * Transform MemU response to n8n standard format with metadata
 */
export declare function transformMemUResponse(response: any, operation: string, originalData?: any): INodeExecutionData;
/**
 * Batch process input data with error handling
 */
export declare function batchProcessInputData<T, R>(inputData: INodeExecutionData[], processor: (item: INodeExecutionData, index: number) => Promise<R>, options?: {
    preserveOrder?: boolean;
    continueOnError?: boolean;
    maxConcurrency?: number;
}): Promise<Array<{
    success: boolean;
    result?: R;
    error?: string;
    originalData: any;
    index: number;
}>>;
/**
 * Clean and normalize text input
 */
export declare function normalizeTextInput(text: string): string;
