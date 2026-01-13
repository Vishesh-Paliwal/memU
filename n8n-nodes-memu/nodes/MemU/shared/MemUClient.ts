import axios, { AxiosInstance, AxiosError, AxiosResponse } from 'axios';
import { ICredentialDataDecryptedObject } from 'n8n-workflow';
import {
	MemorizeParams,
	MemorizeResponse,
	RetrieveParams,
	RetrieveResponse,
	ListItemsParams,
	ListItemsResponse,
	CreateItemParams,
	UpdateItemParams,
	DeleteItemParams,
	ItemOperationResponse,
	MemUClientConfig,
	RetryConfig,
} from './types';
import { sleep } from './utils';

/**
 * MemU API Client Service
 * Handles HTTP communication with MemU API endpoints
 * Supports both MemU Cloud and self-hosted instances
 */
export class MemUClient {
	private baseUrl: string;
	private apiKey?: string;
	private httpClient: AxiosInstance;
	private retryConfig: RetryConfig;

	constructor(credentials: ICredentialDataDecryptedObject, config?: Partial<MemUClientConfig>) {
		this.baseUrl = credentials.baseUrl as string;
		this.apiKey = credentials.apiKey as string;
		
		// Default retry configuration
		this.retryConfig = {
			maxRetries: config?.retryConfig?.maxRetries ?? 3,
			baseDelay: config?.retryConfig?.baseDelay ?? 1000,
			maxDelay: config?.retryConfig?.maxDelay ?? 10000,
			retryCondition: config?.retryConfig?.retryCondition ?? this.shouldRetry.bind(this),
		};

		this.httpClient = this.createHttpClient(config?.timeout);
	}

	/**
	 * Memorize operation - process multimodal content
	 */
	async memorize(params: MemorizeParams): Promise<MemorizeResponse> {
		return this.withRetry(async () => {
			const response: AxiosResponse<MemorizeResponse> = await this.httpClient.post(
				'/memorize',
				{
					resource_url: params.resourceUrl,
					modality: params.modality,
					user: params.user,
				},
			);
			return response.data;
		});
	}

	/**
	 * Retrieve operation - query stored memories
	 */
	async retrieve(params: RetrieveParams): Promise<RetrieveResponse> {
		return this.withRetry(async () => {
			const response: AxiosResponse<RetrieveResponse> = await this.httpClient.post('/retrieve', {
				queries: params.queries,
				where: params.where,
				method: params.method,
			});
			return response.data;
		});
	}

	/**
	 * List items operation - browse stored memories
	 */
	async listItems(params: ListItemsParams): Promise<ListItemsResponse> {
		return this.withRetry(async () => {
			const queryParams = new URLSearchParams();
			if (params.limit) queryParams.append('limit', params.limit.toString());
			if (params.userFilters) {
				Object.entries(params.userFilters).forEach(([key, value]) => {
					if (value) queryParams.append(key, value.toString());
				});
			}

			const endpoint = params.listType === 'categories' ? '/categories' : '/items';
			const url = queryParams.toString() ? `${endpoint}?${queryParams}` : endpoint;

			const response: AxiosResponse<ListItemsResponse> = await this.httpClient.get(url);
			return response.data;
		});
	}

	/**
	 * Create item operation - manually create memory items
	 */
	async createItem(params: CreateItemParams): Promise<ItemOperationResponse> {
		return this.withRetry(async () => {
			const response: AxiosResponse<ItemOperationResponse> = await this.httpClient.post(
				'/items',
				{
					memory_type: params.memory_type,
					content: params.content,
					categories: params.categories,
					user: params.user,
				},
			);
			return response.data;
		});
	}

	/**
	 * Update item operation - modify existing memory items
	 */
	async updateItem(params: UpdateItemParams): Promise<ItemOperationResponse> {
		return this.withRetry(async () => {
			const response: AxiosResponse<ItemOperationResponse> = await this.httpClient.put(
				`/items/${params.id}`,
				{
					memory_type: params.memory_type,
					content: params.content,
					categories: params.categories,
				},
			);
			return response.data;
		});
	}

	/**
	 * Delete item operation - remove memory items
	 */
	async deleteItem(params: DeleteItemParams): Promise<ItemOperationResponse> {
		return this.withRetry(async () => {
			const response: AxiosResponse<ItemOperationResponse> = await this.httpClient.delete(
				`/items/${params.id}`,
			);
			return response.data;
		});
	}

	/**
	 * Retry wrapper with exponential backoff
	 */
	async withRetry<T>(
		operation: () => Promise<T>,
		maxRetries?: number,
		baseDelay?: number,
	): Promise<T> {
		const retries = maxRetries ?? this.retryConfig.maxRetries;
		const delay = baseDelay ?? this.retryConfig.baseDelay;
		let lastError: any;

		for (let attempt = 0; attempt <= retries; attempt++) {
			try {
				return await operation();
			} catch (error) {
				lastError = error;

				if (attempt === retries) {
					throw this.handleApiError(error as AxiosError);
				}

				if (this.retryConfig.retryCondition(error)) {
					const backoffDelay = Math.min(
						delay * Math.pow(2, attempt),
						this.retryConfig.maxDelay,
					);
					console.log(`MemU API retry attempt ${attempt + 1}/${retries + 1} after ${backoffDelay}ms`);
					await sleep(backoffDelay);
				} else {
					throw this.handleApiError(error as AxiosError);
				}
			}
		}

		throw this.handleApiError(lastError);
	}

	/**
	 * Test connection to MemU API
	 */
	async testConnection(): Promise<boolean> {
		try {
			await this.httpClient.get('/health');
			return true;
		} catch (error) {
			console.error('MemU connection test failed:', error);
			return false;
		}
	}

	/**
	 * Create HTTP client with authentication and interceptors
	 */
	private createHttpClient(timeout?: number): AxiosInstance {
		const client = axios.create({
			baseURL: this.baseUrl,
			timeout: timeout ?? 30000,
			headers: {
				'Content-Type': 'application/json',
				'User-Agent': 'n8n-memu-adapter/1.0.0',
			},
		});

		// Add authentication header management for both cloud and self-hosted
		if (this.apiKey) {
			client.defaults.headers.common['Authorization'] = `Bearer ${this.apiKey}`;
		}

		// Request interceptor for logging and authentication
		client.interceptors.request.use(
			(config) => {
				// Ensure authentication header is present for each request
				if (this.apiKey && !config.headers['Authorization']) {
					config.headers['Authorization'] = `Bearer ${this.apiKey}`;
				}
				
				console.log(`MemU API Request: ${config.method?.toUpperCase()} ${config.url}`);
				return config;
			},
			(error) => {
				console.error('MemU API Request Error:', error);
				return Promise.reject(error);
			},
		);

		// Response interceptor for logging and error handling
		client.interceptors.response.use(
			(response) => {
				console.log(`MemU API Response: ${response.status} ${response.statusText}`);
				return response;
			},
			(error) => {
				console.error('MemU API Response Error:', error.response?.status, error.message);
				return Promise.reject(error);
			},
		);

		return client;
	}

	/**
	 * Centralized error handling
	 */
	private handleApiError(error: AxiosError): Error {
		if (error.response) {
			// API responded with error status
			const status = error.response.status;
			const message = (error.response.data as any)?.message || error.message;

			switch (status) {
				case 401:
					return new Error('Authentication failed. Please check your API credentials.');
				case 403:
					return new Error('Access denied. Insufficient permissions.');
				case 429:
					return new Error('Rate limit exceeded. Please try again later.');
				case 404:
					return new Error('Resource not found. Please check the URL or ID.');
				case 422:
					return new Error(`Validation error: ${message}`);
				case 500:
					return new Error('MemU service error. Please try again later.');
				default:
					return new Error(`API Error (${status}): ${message}`);
			}
		} else if (error.request) {
			// Network error
			return new Error(
				'Network error. Please check your connection and MemU service URL.',
			);
		} else {
			// Other errors
			return new Error(`Unexpected error: ${error.message}`);
		}
	}

	/**
	 * Determine if error should trigger retry
	 */
	private shouldRetry(error: AxiosError): boolean {
		// Retry on network errors and 5xx server errors
		return !error.response || (error.response.status >= 500 && error.response.status < 600);
	}
}