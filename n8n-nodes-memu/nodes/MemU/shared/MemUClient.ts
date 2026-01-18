import axios, { AxiosInstance, AxiosError, AxiosResponse } from 'axios';
import { ICredentialDataDecryptedObject } from 'n8n-workflow';
import {
	MemorizeParams,
	MemorizeResponse,
	RetrieveParams,
	RetrieveResponse,
	ListCategoriesParams,
	ListCategoriesResponse,
	MemUClientConfig,
	RetryConfig,
	TaskStatusResponse,
} from './types';
import { sleep } from './utils';

export class MemUClient {
	private baseUrl: string;
	private apiKey?: string;
	private httpClient: AxiosInstance;
	private retryConfig: RetryConfig;

	constructor(credentials: ICredentialDataDecryptedObject, config?: Partial<MemUClientConfig>) {
		this.baseUrl = credentials.baseUrl as string;
		this.apiKey = credentials.apiKey as string;
		this.retryConfig = {
			maxRetries: config?.retryConfig?.maxRetries ?? 3,
			baseDelay: config?.retryConfig?.baseDelay ?? 1000,
			maxDelay: config?.retryConfig?.maxDelay ?? 10000,
			retryCondition: config?.retryConfig?.retryCondition ?? this.shouldRetry.bind(this),
		};
		this.httpClient = this.createHttpClient(config?.timeout);
	}

	async memorize(params: MemorizeParams): Promise<MemorizeResponse> {
		return this.withRetry(async () => {
			const endpoint = '/api/v3/memory/memorize';
			const payload: any = {
				conversation: params.conversation,
				user_id: params.user_id,
				agent_id: params.agent_id,
			};
			if (params.user_name) payload.user_name = params.user_name;
			if (params.agent_name) payload.agent_name = params.agent_name;
			if (params.session_date) payload.session_date = params.session_date;

			const response: AxiosResponse<MemorizeResponse> = await this.httpClient.post(endpoint, payload);
			return response.data;
		});
	}


	async getTaskStatus(taskId: string): Promise<TaskStatusResponse> {
		return this.withRetry(async () => {
			const response: AxiosResponse<TaskStatusResponse> = await this.httpClient.get(
				`/api/v3/memory/memorize/status/${taskId}`,
			);
			return response.data;
		});
	}

	async waitForTaskCompletion(taskId: string, timeoutMs: number = 120000): Promise<TaskStatusResponse> {
		const startTime = Date.now();
		const pollInterval = 5000;
		while (Date.now() - startTime < timeoutMs) {
			const status = await this.getTaskStatus(taskId);
			if (status.status === 'SUCCESS' || status.status === 'FAILED') {
				return status;
			}
			await sleep(pollInterval);
		}
		throw new Error(`Task ${taskId} did not complete within ${timeoutMs}ms timeout`);
	}

	async retrieve(params: RetrieveParams): Promise<RetrieveResponse> {
		return this.withRetry(async () => {
			const endpoint = '/api/v3/memory/retrieve';
			const payload = {
				user_id: params.user_id,
				agent_id: params.agent_id,
				query: params.query,
			};

			const response: AxiosResponse<RetrieveResponse> = await this.httpClient.post(endpoint, payload);
			return response.data;
		});
	}

	async listCategories(params: ListCategoriesParams): Promise<ListCategoriesResponse> {
		return this.withRetry(async () => {
			const response: AxiosResponse<ListCategoriesResponse> = await this.httpClient.post(
				'/api/v3/memory/categories',
				{ user_id: params.user_id, agent_id: params.agent_id }
			);
			return response.data;
		});
	}

	async withRetry<T>(operation: () => Promise<T>, maxRetries?: number, baseDelay?: number): Promise<T> {
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
					const backoffDelay = Math.min(delay * Math.pow(2, attempt), this.retryConfig.maxDelay);
					await sleep(backoffDelay);
				} else {
					throw this.handleApiError(error as AxiosError);
				}
			}
		}
		throw this.handleApiError(lastError);
	}

	async testConnection(): Promise<boolean> {
		try {
			await this.httpClient.get('/');
			return true;
		} catch {
			return false;
		}
	}

	private createHttpClient(timeout?: number): AxiosInstance {
		const client = axios.create({
			baseURL: this.baseUrl,
			timeout: timeout ?? 30000,
			headers: {
				'Content-Type': 'application/json',
				'User-Agent': 'n8n-memu-adapter/1.0.0',
			},
		});
		if (this.apiKey) {
			client.defaults.headers.common['Authorization'] = `Bearer ${this.apiKey}`;
		}
		client.interceptors.request.use(
			(config) => {
				if (this.apiKey && !config.headers['Authorization']) {
					config.headers['Authorization'] = `Bearer ${this.apiKey}`;
				}
				return config;
			},
			(error) => Promise.reject(error),
		);
		return client;
	}

	private handleApiError(error: AxiosError): Error {
		if (error.response) {
			const status = error.response.status;
			const data = error.response.data as any;
			const message = data?.message || data?.detail || error.message;
			switch (status) {
				case 401: return new Error('Authentication failed. Please check your API credentials.');
				case 403: return new Error('Access denied. Insufficient permissions.');
				case 422: return new Error(`Validation error: ${JSON.stringify(data?.detail || message)}`);
				case 429: return new Error('Rate limit exceeded. Please try again later.');
				case 404: return new Error('Resource not found.');
				case 500: return new Error('MemU service error. Please try again later.');
				default: return new Error(`API Error (${status}): ${message}`);
			}
		} else if (error.request) {
			return new Error('Network error. Please check your connection.');
		}
		return new Error(`Unexpected error: ${error.message}`);
	}

	private shouldRetry(error: AxiosError): boolean {
		return !error.response || (error.response.status >= 500 && error.response.status < 600);
	}
}
