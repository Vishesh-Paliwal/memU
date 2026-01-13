// Type definitions for MemU API integration

// ===== Core API Types =====

export interface MemorizeParams {
	resourceUrl: string;
	modality: 'conversation' | 'document' | 'image' | 'video' | 'audio';
	user?: Record<string, any>;
}

// ===== n8n Node Property Types =====

export interface NodeCredentials {
	memUCloudApi?: {
		apiKey: string;
		baseUrl: string;
	};
	memUSelfHostedApi?: {
		baseUrl: string;
		authMethod: 'apiKey' | 'none';
		apiKey?: string;
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

export interface MemorizeResponse {
	resource?: ResourceData;
	resources?: ResourceData[];
	items: MemoryItemData[];
	categories: CategoryData[];
	relations: RelationData[];
}

export interface RetrieveParams {
	queries: QueryMessage[];
	where?: Record<string, any>;
	method?: 'rag' | 'llm';
}

export interface RetrieveResponse {
	needs_retrieval: boolean;
	original_query: string;
	rewritten_query: string;
	next_step_query?: string;
	categories: CategoryResult[];
	items: MemoryItemResult[];
	resources: ResourceResult[];
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

export interface ListItemsParams {
	listType: 'items' | 'categories';
	userFilters?: Record<string, any>;
	limit?: number;
	includeEmpty?: boolean;
}

export interface ListItemsResponse {
	items?: MemoryItemData[];
	categories?: CategoryData[];
	total_count: number;
}

export interface CreateItemParams {
	memory_type: 'behavior' | 'event' | 'knowledge' | 'profile' | 'skill';
	content: string;
	categories?: string[];
	user?: Record<string, any>;
}

export interface UpdateItemParams {
	id: string;
	memory_type?: 'behavior' | 'event' | 'knowledge' | 'profile' | 'skill';
	content?: string;
	categories?: string[];
}

export interface DeleteItemParams {
	id: string;
}

export interface ItemOperationResponse {
	success: boolean;
	item?: MemoryItemData;
	message?: string;
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