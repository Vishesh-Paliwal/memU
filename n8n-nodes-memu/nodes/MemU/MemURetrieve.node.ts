import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	INodeProperties,
	NodeOperationError,
} from 'n8n-workflow';

import { MemUClient } from './shared/MemUClient';
import { RetrieveParams, QueryMessage } from './shared/types';
import {
	handleMemUError,
	transformMemUResponse,
	batchProcessInputData,
	normalizeTextInput,
} from './shared/utils';

export class MemURetrieve implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'MemU Retrieve',
		name: 'memURetrieve',
		icon: 'file:memu.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["querySource"] === "manual" ? "Manual Query" : "From Input"}}',
		description: 'Query and retrieve relevant memories from MemU using semantic search',
		defaults: {
			name: 'MemU Retrieve',
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
				displayName: 'Query Source',
				name: 'querySource',
				type: 'options',
				options: [
					{ name: 'From Input', value: 'input' },
					{ name: 'Manual Query', value: 'manual' },
				],
				default: 'input',
				description: 'Source of the query text',
			},
			{
				displayName: 'Query Text',
				name: 'queryText',
				type: 'string',
				displayOptions: {
					show: { querySource: ['manual'] },
				},
				default: '',
				placeholder: 'What sports does the user enjoy?',
				description: 'Natural language query to search memories',
				required: true,
			},
			{
				displayName: 'Query Field',
				name: 'queryField',
				type: 'string',
				displayOptions: {
					show: { querySource: ['input'] },
				},
				default: 'query',
				description: 'Field name containing the query text in input data',
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
				displayName: 'Query Format',
				name: 'queryFormat',
				type: 'options',
				options: [
					{
						name: 'Simple String',
						value: 'string',
						description: 'Send query as a simple string',
					},
					{
						name: 'Message List (with Query Rewriting)',
						value: 'messages',
						description: 'Send as message list for context-aware query rewriting',
					},
				],
				default: 'string',
				description: 'Format for sending the query. Message list enables automatic query rewriting based on conversation context.',
			},
			{
				displayName: 'Context Messages',
				name: 'contextMessages',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
				},
				displayOptions: {
					show: { queryFormat: ['messages'] },
				},
				default: { messages: [] },
				options: [
					{
						name: 'messages',
						displayName: 'Context Message',
						values: [
							{
								displayName: 'Role',
								name: 'role',
								type: 'options',
								options: [
									{ name: 'User', value: 'user' },
									{ name: 'Assistant', value: 'assistant' },
								],
								default: 'user',
								description: 'Role of the message sender',
							},
							{
								displayName: 'Content',
								name: 'content',
								type: 'string',
								default: '',
								description: 'Message content for context',
								required: true,
							},
						],
					},
				],
				description: 'Previous conversation context for query rewriting. The last message is used as the query.',
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
						name: 'timeout',
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
		const querySource = this.getNodeParameter('querySource', 0) as string;
		const queryFormat = this.getNodeParameter('queryFormat', 0) as string;
		const userId = this.getNodeParameter('userId', 0) as string;
		const agentId = this.getNodeParameter('agentId', 0) as string;
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
			timeout: (advancedOptions.timeout || 30) * 1000,
		});

		// Process items
		const results = await batchProcessInputData(
			items,
			async (item: INodeExecutionData, index: number) => {
				// Get query text based on source
				let queryText: string;
				if (querySource === 'manual') {
					queryText = this.getNodeParameter('queryText', index) as string;
				} else {
					const queryField = this.getNodeParameter('queryField', index) as string;
					queryText = item.json[queryField] as string;
				}

				// Normalize query text
				queryText = normalizeTextInput(queryText);

				if (!queryText) {
					throw new NodeOperationError(
						this.getNode(),
						'Query text is required',
					);
				}

				// Prepare query - either as string or message list
				let query: string | QueryMessage[];

				if (queryFormat === 'messages') {
					const contextMessages = this.getNodeParameter('contextMessages', index, { messages: [] }) as {
						messages: Array<{ role: string; content: string }>
					};

					// Build message list with context + query
					query = [];
					if (contextMessages.messages?.length > 0) {
						for (const msg of contextMessages.messages) {
							query.push({
								role: msg.role as 'user' | 'assistant',
								content: { text: msg.content },
							});
						}
					}
					// Add the main query as the last message
					query.push({
						role: 'user',
						content: { text: queryText },
					});
				} else {
					query = queryText;
				}

				// Prepare retrieve parameters
				const retrieveParams: RetrieveParams = {
					user_id: userId,
					agent_id: agentId,
					query,
				};

				// Call MemU API
				const response = await memUClient.retrieve(retrieveParams);

				// Transform response to n8n format
				return transformMemUResponse(response, 'retrieve', item.json);
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
