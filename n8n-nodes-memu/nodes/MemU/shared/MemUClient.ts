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
} from './types';
import { sleep } from './utils';

/**
 * MemU API Client Service
 * Handles HTTP communication with MemU API endpoints
 */
export class MemUClient {
	private baseUrl: string;
	private apiKey?: string;
	private httpClient: AxiosInstance;

	constructor(credentials: ICredentialDataDecryptedObject) {
		this.baseUrl = credentials.baseUrl as string;
		this.apiKey = credentials.apiKey as string;
		this.httpClient = this.createHttpClient();
	}

	/**
	 * Memorize operation - process multimodal content
	 */
	async memorize(params: MemorizeParams): Promise<MemorizeResponse> {
		try {
			const response: AxiosResponse<MemorizeResponse> = await this.httpClient.post(
				'/memorize',
				{
					resource_url: params.resourceUrl,
					modality: params.modality,
					user: params.user,
				},
			);
			return response.data;
		} catch (error) {
			throw this.handleApiError(error as AxiosError);
		}
	}

	/**
	 * Retrieve operation - query stored memories
	 */
	async retrieve(params: RetrieveParams): Promise<RetrieveResponse> {
		try {
			const response: AxiosResponse<RetrieveResponse> = await this.httpClient.post('/retrieve', {
				queries: params.queries,
				where: params.where,
				method: params.method,
			});
			return response.data;
		} catch (error) {
			throw this.handleApiError(error as AxiosError);
		}
	}

	/**
	 * List items operation - browse stored memories
	 */
	async listItems(params: ListItemsParams): Promise<ListItemsResponse> {
		try {
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
		} catch (error) {
			throw this.handleApiError(error as AxiosError);
		}
	}

	/**
	 * Create item operation - manually create memory items
	 */
	async createItem(params: CreateItemParams): Promise<ItemOperationResponse> {
		try {
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
		} catch (error) {
			throw this.handleApiError(error as AxiosError);
		}
	}

	/**
	 * Update item operation - modify existing memory items
	 */
	async updateItem(params: UpdateItemParams): Promise<ItemOperationResponse> {
		try {
			const response: AxiosResponse<ItemOperationResponse> = await this.httpClient.put(
				`/items/${params.id}`,
				{
					memory_type: params.memory_type,
					content: params.content,
					categories: params.categories,
				},
			);
			return response.data;
		} catch (error) {
			throw this.handleApiError(error as AxiosError);
		}
	}

	/**
	 * Delete item operation - remove memory items
	 */
	async deleteItem(params: DeleteItemParams): Promise<ItemOperationResponse> {
		try {
			const response: AxiosResponse<ItemOperationResponse> = await this.httpClient.delete(
				`/items/${params.id}`,
			);
			return response.data;
		} catch (error) {
			throw this.handleApiError(error as AxiosError);
		}
	}

	/**
	 * Retry wrapper with exponential backoff
	 */
	async withRetry<T>(
		operation: () => Promise<T>,
		maxRetries: number = 3,
		baseDelay: number = 1000,
	): Promise<T> {
		let lastError: any;

		for (let attempt = 0; attempt <= maxRetries; attempt++) {
			try {
				return await operation();
			} catch (error) {
				lastError = error;

				if (attempt === maxRetries) {
					throw error;
				}

				if (this.shouldRetry(error as AxiosError)) {
					const delay = baseDelay * Math.pow(2, attempt);
					await sleep(delay);
				} else {
					throw error;
				}
			}
		}

		throw lastError;
	}

	/**
	 * Create HTTP client with authentication and interceptors
	 */
	private createHttpClient(): AxiosInstance {
		const client = axios.create({
			baseURL: this.baseUrl,
			timeout: 30000,
			headers: {
				'Content-Type': 'application/json',
			},
		});

		// Add authentication header if API key is provided
		if (this.apiKey) {
			client.defaults.headers.common['Authorization'] = `Bearer ${this.apiKey}`;
		}

		// Request interceptor for logging
		client.interceptors.request.use(
			(config) => {
				console.log(`MemU API Request: ${config.method?.toUpperCase()} ${config.url}`);
				return config;
			},
			(error) => {
				console.error('MemU API Request Error:', error);
				return Promise.reject(error);
			},
		);

		// Response interceptor for logging
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