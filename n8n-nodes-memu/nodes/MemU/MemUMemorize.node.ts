import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	INodeProperties,
	NodeOperationError,
} from 'n8n-workflow';

import { MemUClient } from './shared/MemUClient';
import { MemorizeParams, ConversationMessage } from './shared/types';
import {
	handleMemUError,
	transformMemUResponse,
	batchProcessInputData,
} from './shared/utils';

/**
 * Normalize various conversation formats to the expected format
 */
function normalizeConversation(raw: any): ConversationMessage[] {
	if (!raw) return [];

	let messages: any[];

	// Handle different input formats
	if (Array.isArray(raw)) {
		messages = raw;
	} else if (raw.messages && Array.isArray(raw.messages)) {
		messages = raw.messages;
	} else if (raw.content && Array.isArray(raw.content)) {
		messages = raw.content;
	} else if (raw.conversation && Array.isArray(raw.conversation)) {
		messages = raw.conversation;
	} else {
		return [];
	}

	return messages.map(msg => {
		// Extract content - handle both string and object formats
		let content: string;
		if (typeof msg.content === 'string') {
			content = msg.content;
		} else if (msg.content?.text) {
			content = msg.content.text;
		} else if (msg.text) {
			content = msg.text;
		} else if (msg.message) {
			content = msg.message;
		} else {
			content = String(msg.content || '');
		}

		const normalized: ConversationMessage = {
			role: (msg.role === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant',
			content,
		};

		// Add optional fields
		if (msg.name) normalized.name = msg.name;
		if (msg.created_at) normalized.created_at = msg.created_at;

		return normalized;
	});
}

export class MemUMemorize implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'MemU Memorize',
		name: 'memUMemorize',
		icon: 'file:memu.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["conversationSource"]}}',
		description: 'Extract and store structured memory from conversations (requires minimum 3 messages)',
		defaults: {
			name: 'MemU Memorize',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'memUCloudApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Conversation Source',
				name: 'conversationSource',
				type: 'options',
				options: [
					{ name: 'From Input', value: 'input' },
					{ name: 'Manual', value: 'manual' },
				],
				default: 'input',
				description: 'Source of the conversation to memorize',
			},
			{
				displayName: 'Conversation Field',
				name: 'conversationField',
				type: 'string',
				displayOptions: {
					show: { conversationSource: ['input'] },
				},
				default: 'messages',
				description: 'Field name containing the conversation messages array in input data. Expected format: [{role: "user"|"assistant", content: "..."}]',
				required: true,
			},
			{
				displayName: 'Conversation Messages',
				name: 'conversationMessages',
				type: 'json',
				displayOptions: {
					show: { conversationSource: ['manual'] },
				},
				default: '[\n  {"role": "user", "content": "Hello"},\n  {"role": "assistant", "content": "Hi there!"},\n  {"role": "user", "content": "How are you?"}\n]',
				description: 'JSON array of conversation messages. Minimum 3 messages required. Format: [{role: "user"|"assistant", content: "...", name?: "...", created_at?: "..."}]',
				required: true,
			},
			{
				displayName: 'User ID',
				name: 'userId',
				type: 'string',
				default: '',
				placeholder: 'user_123',
				description: 'Unique identifier for the user (required)',
				required: true,
			},
			{
				displayName: 'Agent ID',
				name: 'agentId',
				type: 'string',
				default: '',
				placeholder: 'agent_456',
				description: 'Unique identifier for the AI agent (required)',
				required: true,
			},
			{
				displayName: 'Additional Options',
				name: 'additionalOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'User Name',
						name: 'userName',
						type: 'string',
						default: '',
						description: 'Display name for the user',
					},
					{
						displayName: 'Agent Name',
						name: 'agentName',
						type: 'string',
						default: '',
						description: 'Display name for the AI agent',
					},
					{
						displayName: 'Session Date',
						name: 'sessionDate',
						type: 'string',
						default: '',
						placeholder: '2024-01-15T10:30:00Z',
						description: 'ISO 8601 timestamp of the conversation session',
					},
					{
						displayName: 'Wait for Completion',
						name: 'waitForCompletion',
						type: 'boolean',
						default: false,
						description: 'Whether to wait for the memorization task to complete before returning',
					},
					{
						displayName: 'Timeout (Seconds)',
						name: 'timeout',
						type: 'number',
						default: 120,
						description: 'Maximum time to wait for task completion (only used if Wait for Completion is enabled)',
					},
				],
			},
			{
				displayName: 'Advanced Options',
				name: 'advancedOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Request Timeout (Seconds)',
						name: 'requestTimeout',
						type: 'number',
						default: 30,
						description: 'HTTP request timeout in seconds',
					},
					{
						displayName: 'Continue on Error',
						name: 'continueOnError',
						type: 'boolean',
						default: false,
						description: 'Whether to continue processing other items if one fails',
					},
				],
			},
		] as INodeProperties[],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const conversationSource = this.getNodeParameter('conversationSource', 0) as string;
		const userId = this.getNodeParameter('userId', 0) as string;
		const agentId = this.getNodeParameter('agentId', 0) as string;
		const additionalOptions = this.getNodeParameter('additionalOptions', 0, {}) as Record<string, any>;
		const advancedOptions = this.getNodeParameter('advancedOptions', 0, {}) as Record<string, any>;

		// Validate required fields
		if (!userId) {
			throw new NodeOperationError(this.getNode(), 'User ID is required');
		}
		if (!agentId) {
			throw new NodeOperationError(this.getNode(), 'Agent ID is required');
		}

		// Get credentials
		let credentials;
		try {
			credentials = await this.getCredentials('memUCloudApi');
		} catch {
			throw new NodeOperationError(
				this.getNode(),
				'MemU Cloud API credentials are required.',
			);
		}

		if (!credentials) {
			throw new NodeOperationError(
				this.getNode(),
				'No MemU credentials configured. Please add MemU Cloud API credentials.',
			);
		}

		// Create MemU client
		const memUClient = new MemUClient(credentials, {
			timeout: (advancedOptions.requestTimeout || 30) * 1000,
		});

		// Process items
		const results = await batchProcessInputData(
			items,
			async (item: INodeExecutionData, index: number) => {
				// Get conversation messages
				let conversation: ConversationMessage[];

				if (conversationSource === 'manual') {
					const messagesJson = this.getNodeParameter('conversationMessages', index) as string;
					try {
						const parsed = JSON.parse(messagesJson);
						conversation = normalizeConversation(parsed);
					} catch (e) {
						throw new NodeOperationError(
							this.getNode(),
							`Invalid JSON in conversation messages: ${(e as Error).message}`,
						);
					}
				} else {
					const conversationField = this.getNodeParameter('conversationField', index) as string;
					const rawMessages = item.json[conversationField];

					if (!rawMessages) {
						throw new NodeOperationError(
							this.getNode(),
							`Field "${conversationField}" not found in input data`,
						);
					}

					conversation = normalizeConversation(rawMessages);
				}

				// Validate minimum 3 messages
				if (conversation.length < 3) {
					throw new NodeOperationError(
						this.getNode(),
						`Minimum 3 messages required for memorization. Got ${conversation.length} messages.`,
					);
				}

				// Prepare memorize parameters
				const memorizeParams: MemorizeParams = {
					conversation,
					user_id: userId,
					agent_id: agentId,
				};

				// Add optional fields
				if (additionalOptions.userName) {
					memorizeParams.user_name = additionalOptions.userName;
				}
				if (additionalOptions.agentName) {
					memorizeParams.agent_name = additionalOptions.agentName;
				}
				if (additionalOptions.sessionDate) {
					memorizeParams.session_date = additionalOptions.sessionDate;
				}

				// Call MemU API
				let response = await memUClient.memorize(memorizeParams);

				// If wait for completion is enabled and we got a task_id
				if (additionalOptions.waitForCompletion && response.task_id) {
					const timeoutMs = (additionalOptions.timeout || 120) * 1000;
					const taskStatus = await memUClient.waitForTaskCompletion(response.task_id, timeoutMs);
					response = { ...response, ...taskStatus };
				}

				// Transform response to n8n format
				return transformMemUResponse(response, 'memorize', item.json);
			},
			{
				continueOnError: advancedOptions.continueOnError || false,
				maxConcurrency: 3,
			},
		);

		// Process results and create output
		const outputData: INodeExecutionData[] = [];

		for (const result of results) {
			if (result.success && result.result) {
				outputData.push(result.result);
			} else if (result.error) {
				const errorOutput = handleMemUError(
					new Error(result.error),
					result.originalData,
				);
				outputData.push(errorOutput);
			}
		}

		return [outputData];
	}
}
