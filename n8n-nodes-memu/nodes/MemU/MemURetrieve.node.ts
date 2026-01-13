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
	extractQueryFromInput,
	validateInputParameters,
	handleMemUError,
	transformMemUResponse,
	formatContextMessages,
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
		subtitle: '={{$parameter["querySource"] === "manual" ? $parameter["method"] + " retrieval" : "From Input: " + $parameter["method"]}}',
		description: 'Query and retrieve relevant memories from MemU',
		defaults: {
			name: 'MemU Retrieve',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'memUCloudApi',
				required: false,
			},
			{
				name: 'memUSelfHostedApi',
				required: false,
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
				placeholder: 'What are the user preferences?',
				description: 'Query to search for in memory',
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
				displayName: 'Retrieval Method',
				name: 'method',
				type: 'options',
				options: [
					{
						name: 'RAG (Fast)',
						value: 'rag',
						description: 'Fast embedding-based search with similarity scores',
					},
					{
						name: 'LLM (Deep)',
						value: 'llm',
						description: 'Deep semantic understanding using LLM reasoning',
					},
				],
				default: 'rag',
				description: 'Method for retrieving memories',
			},
			{
				displayName: 'Context Messages',
				name: 'contextMessages',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
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
									{ name: 'System', value: 'system' },
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
				description: 'Previous conversation context for better retrieval',
			},
			{
				displayName: 'Filters',
				name: 'filters',
				type: 'collection',
				placeholder: 'Add Filter',
				default: {},
				options: [
					{
						displayName: 'User ID',
						name: 'user_id',
						type: 'string',
						default: '',
						description: 'Filter by specific user ID',
					},
					{
						displayName: 'Agent ID',
						name: 'agent_id',
						type: 'string',
						default: '',
						description: 'Filter by specific agent ID',
					},
					{
						displayName: 'Session ID',
						name: 'session_id',
						type: 'string',
						default: '',
						description: 'Filter by specific session ID',
					},
					{
						displayName: 'Memory Type',
						name: 'memory_type',
						type: 'options',
						options: [
							{ name: 'Behavior', value: 'behavior' },
							{ name: 'Event', value: 'event' },
							{ name: 'Knowledge', value: 'knowledge' },
							{ name: 'Profile', value: 'profile' },
							{ name: 'Skill', value: 'skill' },
						],
						default: 'behavior',
						description: 'Filter by memory type',
					},
				],
				description: 'Filters to limit retrieval scope',
			},
			{
				displayName: 'Advanced Options',
				name: 'advancedOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Timeout (Seconds)',
						name: 'timeout',
						type: 'number',
						default: 30,
						description: 'Request timeout in seconds',
					},
					{
						displayName: 'Whether to Continue on Error',
						name: 'continueOnError',
						type: 'boolean',
						default: false,
						description: 'Whether to continue processing other items if one fails',
					},
					{
						displayName: 'Whether to Include Context in Query',
						name: 'includeContextInQuery',
						type: 'boolean',
						default: true,
						description: 'Whether to include context messages in the query for better results',
					},
				],
			},
		] as INodeProperties[],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const querySource = this.getNodeParameter('querySource', 0) as string;
		const method = this.getNodeParameter('method', 0) as string;
		const contextMessages = this.getNodeParameter('contextMessages', 0, { messages: [] }) as { messages: Array<{ role: string; content: string }> };
		const filters = this.getNodeParameter('filters', 0, {}) as Record<string, any>;
		const advancedOptions = this.getNodeParameter('advancedOptions', 0, {}) as Record<string, any>;

		// Get credentials
		const credentials = await this.getCredentials('memUCloudApi') || 
						   await this.getCredentials('memUSelfHostedApi');
		
		if (!credentials) {
			throw new NodeOperationError(
				this.getNode(),
				'No MemU credentials configured. Please add either MemU Cloud API or MemU Self-hosted API credentials.',
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

				// Normalize and validate query text
				queryText = normalizeTextInput(queryText);

				// Validate input parameters
				const validationResult = validateInputParameters({
					query: queryText,
					method,
					operation: 'retrieve',
				});

				if (!validationResult.isValid) {
					throw new NodeOperationError(
						this.getNode(),
						`Validation failed: ${validationResult.errors.join(', ')}`,
					);
				}

				// Prepare query messages
				const queries: QueryMessage[] = [];

				// Add context messages if provided and enabled
				if (advancedOptions.includeContextInQuery !== false && contextMessages.messages?.length > 0) {
					const formattedContextMessages = formatContextMessages(contextMessages.messages);
					queries.push(...formattedContextMessages);
				}

				// Add the main query
				queries.push({
					role: 'user',
					content: {
						text: queryText,
					},
				});

				// Clean filters (remove empty values)
				const cleanFilters: Record<string, any> = {};
				Object.entries(filters).forEach(([key, value]) => {
					if (value !== undefined && value !== null && value !== '') {
						cleanFilters[key] = value;
					}
				});

				// Prepare retrieve parameters
				const retrieveParams: RetrieveParams = {
					queries,
					method: method as 'rag' | 'llm',
					where: Object.keys(cleanFilters).length > 0 ? cleanFilters : undefined,
				};

				// Call MemU API
				const response = await memUClient.retrieve(retrieveParams);

				// Transform response to n8n format
				return transformMemUResponse(response, 'retrieve', item.json);
			},
			{
				continueOnError: advancedOptions.continueOnError || false,
				maxConcurrency: 3, // Limit concurrent requests to avoid overwhelming the API
			},
		);

		// Process results and create output
		const outputData: INodeExecutionData[] = [];

		for (const result of results) {
			if (result.success && result.result) {
				outputData.push(result.result);
			} else if (result.error) {
				// Create error output
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