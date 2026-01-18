/**
 * Conversation message format for MemU Cloud API
 * Based on: https://memu.pro/docs#platform-apis
 */
export interface ConversationMessage {
    role: 'user' | 'assistant';
    content: string;
    name?: string;
    created_at?: string;
}
/**
 * Parameters for Cloud API memorize endpoint
 * POST /api/v3/memory/memorize
 */
export interface MemorizeParams {
    conversation: ConversationMessage[];
    user_id: string;
    agent_id: string;
    user_name?: string;
    agent_name?: string;
    session_date?: string;
}
/**
 * Response from memorize endpoint
 */
export interface MemorizeResponse {
    task_id: string;
    status: 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED';
    message?: string;
}
/**
 * Task status response
 * GET /api/v3/memory/memorize/status/{task_id}
 */
export interface TaskStatusResponse {
    task_id: string;
    status: 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED';
    created_at?: string;
    completed_at?: string;
    error?: string;
}
export interface RetryConfig {
    maxRetries: number;
    baseDelay: number;
    maxDelay: number;
    retryCondition: (error: any) => boolean;
}
/**
 * Parameters for retrieve endpoint
 * POST /api/v3/memory/retrieve
 */
export interface RetrieveParams {
    user_id: string;
    agent_id: string;
    query: string | QueryMessage[];
}
export interface RetrieveResponse {
    rewritten_query?: string;
    categories: CategoryResult[];
    items: MemoryItemResult[];
    resources: ResourceResult[];
}
/**
 * Parameters for list categories endpoint
 * POST /api/v3/memory/categories
 */
export interface ListCategoriesParams {
    user_id: string;
    agent_id: string;
}
export interface ListCategoriesResponse {
    status: string;
    categories: Array<{
        id: string;
        name: string;
        description?: string;
        memory_count: number;
    }>;
}
export interface QueryMessage {
    role: string;
    content: {
        text: string;
    };
}
export interface CategoryResult {
    id: string;
    name: string;
    summary: string;
    score?: number;
}
export interface MemoryItemResult {
    id: string;
    summary: string;
    memory_type: string;
    score?: number;
}
export interface ResourceResult {
    id: string;
    url: string;
    modality: string;
    caption?: string;
    score?: number;
}
export interface MemUClientConfig {
    baseUrl: string;
    apiKey?: string;
    timeout?: number;
    retryConfig?: RetryConfig;
}
