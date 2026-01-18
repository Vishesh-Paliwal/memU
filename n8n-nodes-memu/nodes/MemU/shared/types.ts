// Type definitions for MemU API integration

// ===== Core API Types =====

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
	// Cloud API fields
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

// ===== n8n Node Property Types =====

export interface NodeCredentials {
	memUCloudApi?: {
		apiKey: string;
		baseUrl: string;
	};
}

export interface NodePropertyOptions {
	name: string;
	value: string;
	description?: string;
}

export interface ValidationResult {
	isValid: boolean;
	errors: string[];
}

// ===== Error Handling Types =====

export interface MemUError {
	code: string;
	message: string;
	details?: any;
	statusCode?: number;
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

export interface ResourceData {
	id: string;
	url: string;
	modality: string;
	local_path?: string;
	caption?: string;
	created_at: string;
	updated_at: string;
}

export interface MemoryItemData {
	id: string;
	resource_id: string;
	memory_type: string;
	summary: string;
	created_at: string;
	updated_at: string;
}

export interface CategoryData {
	id: string;
	name: string;
	description?: string;
	summary?: string;
	created_at: string;
	updated_at: string;
}

export interface RelationData {
	id: string;
	source_id: string;
	target_id: string;
	relation_type: string;
	created_at: string;
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

// ===== Input Validation Types =====

export interface InputValidationError {
	field: string;
	message: string;
	value?: any;
}

export interface BatchProcessingResult<T> {
	successful: T[];
	failed: Array<{
		input: any;
		error: string;
	}>;
	totalProcessed: number;
}

// ===== n8n Integration Types =====

export interface N8nNodeInput {
	resourceSource?: 'input' | 'manual';
	resourceUrl?: string;
	resourceUrlField?: string;
	modality?: string;
	querySource?: 'input' | 'manual';
	queryText?: string;
	queryField?: string;
	method?: 'rag' | 'llm';
	userScoping?: Record<string, any>;
	filters?: Record<string, any>;
}

export interface N8nNodeOutput {
	json: Record<string, any>;
	binary?: Record<string, any>;
}

// ===== Configuration Types =====

export interface MemUClientConfig {
	baseUrl: string;
	apiKey?: string;
	timeout?: number;
	retryConfig?: RetryConfig;
}

export interface ConnectionPoolConfig {
	maxConnections: number;
	keepAlive: boolean;
	timeout: number;
}