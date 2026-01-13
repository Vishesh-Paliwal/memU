// Type definitions for MemU API integration

export interface MemorizeParams {
	resourceUrl: string;
	modality: 'conversation' | 'document' | 'image' | 'video' | 'audio';
	user?: Record<string, any>;
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