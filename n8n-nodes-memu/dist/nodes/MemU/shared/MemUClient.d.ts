import { ICredentialDataDecryptedObject } from 'n8n-workflow';
import { MemorizeParams, MemorizeResponse, RetrieveParams, RetrieveResponse, ListCategoriesParams, ListCategoriesResponse, MemUClientConfig, TaskStatusResponse } from './types';
export declare class MemUClient {
    private baseUrl;
    private apiKey?;
    private httpClient;
    private retryConfig;
    constructor(credentials: ICredentialDataDecryptedObject, config?: Partial<MemUClientConfig>);
    memorize(params: MemorizeParams): Promise<MemorizeResponse>;
    getTaskStatus(taskId: string): Promise<TaskStatusResponse>;
    waitForTaskCompletion(taskId: string, timeoutMs?: number): Promise<TaskStatusResponse>;
    retrieve(params: RetrieveParams): Promise<RetrieveResponse>;
    listCategories(params: ListCategoriesParams): Promise<ListCategoriesResponse>;
    withRetry<T>(operation: () => Promise<T>, maxRetries?: number, baseDelay?: number): Promise<T>;
    testConnection(): Promise<boolean>;
    private createHttpClient;
    private handleApiError;
    private shouldRetry;
}
