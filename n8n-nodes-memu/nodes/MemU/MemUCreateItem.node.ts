import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';

import { MemUClient } from './shared/MemUClient';
import { CreateItemParams, NodeCredentials } from './shared/types';
import { 
	handleMemUError, 
	transformMemUResponse, 
	validateInputParameters,
	extractUserContext,
	normalizeTextInput,
	isValidMemoryType
} from './shared/utils';

export class MemUCreateItem implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'MemU Create Item',
		name: 'memUCreateItem',
		icon: 'file:memu.svg',
		group: ['output'],
		version: 1,
		subtitle: '={{$parameter["memoryType"]}} item',
		description: 'Create new memory items manually',
		defaults: {
			name: 'MemU Create Item',
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
				displayName: 'Content Source',
				name: 'contentSource',
				type: 'options',
				options: [
					{
						name: 'From Input',
						value: 'input',
						description: 'Extract content from input data',
					},
					{
						name: 'Manual Entry',
						value: 'manual',
						description: 'Enter content manually',
					},
				],
				default: 'input',
				description: 'Source of the memory content',
			},
			{
				displayName: 'Content',
				name: 'content',
				type: 'string',
				typeOptions: {
					rows: 4,
				},
				displayOptions: {
					show: {
						contentSource: ['manual'],
					},
				},
				default: '',
				placeholder: 'Enter the memory content...',
				description: 'The content to store as a memory item',
				required: true,
			},
			{
				displayName: 'Content Field',
				name: 'contentField',
				type: 'string',
				displayOptions: {
					show: {
						contentSource: ['input'],
					},
				},
				default: 'content',
				description: 'Field name containing the content in input data',
				required: true,
			},
			{
				displayName: 'Memory Type',
				name: 'memoryType',
				type: 'options',
				options: [
					{
						name: 'Behavior',
						value: 'behavior',
						description: 'Behavioral patterns and preferences',
					},
					{
						name: 'Event',
						value: 'event',
						description: 'Specific events and occurrences',
					},
					{
						name: 'Knowledge',
						value: 'knowledge',
						description: 'Facts and information',
					},
					{
						name: 'Profile',
						value: 'profile',
						description: 'Personal information and characteristics',
					},
					{
						name: 'Skill',
						value: 'skill',
						description: 'Abilities and competencies',
					},
				],
				default: 'knowledge',
				description: 'Type of memory being created',
				required: true,
			},
			{
				displayName: 'Category Assignment',
				name: 'categoryAssignment',
				type: 'options',
				options: [
					{
						name: 'Auto-assign',
						value: 'auto',
						description: 'Let MemU automatically assign categories',
					},
					{
						name: 'Manual Categories',
						value: 'manual',
						description: 'Specify categories manually',
					},
					{
						name: 'From Input',
						value: 'input',
						description: 'Extract categories from input data',
					},
				],
				default: 'auto',
				description: 'How to assign categories to the memory item',
			},
			{
				displayName: 'Categories',
				name: 'categories',
				type: 'string',
				displayOptions: {
					show: {
						categoryAssignment: ['manual'],
					},
				},
				default: '',
				placeholder: 'category1, category2, category3',
				description: 'Comma-separated list of category names',
			},
			{
				displayName: 'Categories Field',
				name: 'categoriesField',
				type: 'string',
				displayOptions: {
					show: {
						categoryAssignment: ['input'],
					},
				},
				default: 'categories',
				description: 'Field name containing categories in input data (array or comma-separated string)',
			},
			{
				displayName: 'User Scoping',
				name: 'userScoping',
				type: 'collection',
				placeholder: 'Add User Field',
				default: {},
				options: [
					{
						displayName: 'User ID',
						name: 'user_id',
						type: 'string',
						default: '',
						description: 'Unique identifier for the user',
					},
					{
						displayName: 'Agent ID',
						name: 'agent_id',
						type: 'string',
						default: '',
						description: 'Identifier for the agent or bot',
					},
					{
						displayName: 'Session ID',
						name: 'session_id',
						type: 'string',
						default: '',
						description: 'Session identifier for grouping',
					},
				],
				description: 'User context for scoped memory storage',
			},
			{
				displayName: 'Additional Options',
				name: 'additionalOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Validate Content',
						name: 'validateContent',
						type: 'boolean',
						default: true,
						description: 'Validate content before creating memory item',
					},
					{
						displayName: 'Skip Duplicates',
						name: 'skipDuplicates',
						type: 'boolean',
						default: false,
						description: 'Skip creation if similar content already exists',
					},
					{
						displayName: 'Auto-summarize',
						name: 'autoSummarize',
						type: 'boolean',
						default: true,
						description: 'Automatically generate summary for long content',
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		// Get credentials
		let credentials: NodeCredentials;
		try {
			const cloudCreds = await this.getCredentials('memUCloudApi').catch(() => null);
			const selfHostedCreds = await this.getCredentials('memUSelfHostedApi').catch(() => null);
			
			if (cloudCreds) {
				credentials = { memUCloudApi: cloudCreds as any };
			} else if (selfHostedCreds) {
				credentials = { memUSelfHostedApi: selfHostedCreds as any };
			} else {
				throw new NodeOperationError(
					this.getNode(),
					'No MemU credentials configured. Please add either MemU Cloud API or MemU Self-hosted API credentials.',
				);
			}
		} catch (error) {
			if (error instanceof NodeOperationError) {
				throw error;
			}
			throw new NodeOperationError(this.getNode(), `Failed to get credentials: ${error instanceof Error ? error.message : String(error)}`);
		}

		// Create MemU client
		const credentialData = credentials.memUCloudApi || credentials.memUSelfHostedApi;
		const memUClient = new MemUClient(credentialData!);

		// Process each input item
		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			const inputItem = items[itemIndex];

			try {
				// Get node parameters for this item
				const contentSource = this.getNodeParameter('contentSource', itemIndex) as string;
				const memoryType = this.getNodeParameter('memoryType', itemIndex) as string;
				const categoryAssignment = this.getNodeParameter('categoryAssignment', itemIndex) as string;
				const userScoping = this.getNodeParameter('userScoping', itemIndex, {}) as Record<string, any>;
				const additionalOptions = this.getNodeParameter('additionalOptions', itemIndex, {}) as Record<string, any>;

				// Extract content based on source
				let content: string;
				if (contentSource === 'manual') {
					content = this.getNodeParameter('content', itemIndex) as string;
				} else {
					const contentField = this.getNodeParameter('contentField', itemIndex) as string;
					content = inputItem.json[contentField] as string;
				}

				// Validate required fields
				if (!content || content.trim() === '') {
					throw new NodeOperationError(
						this.getNode(),
						`Content is required for memory item creation (item ${itemIndex})`,
					);
				}

				if (!isValidMemoryType(memoryType)) {
					throw new NodeOperationError(
						this.getNode(),
						`Invalid memory type: ${memoryType}. Must be one of: behavior, event, knowledge, profile, skill`,
					);
				}

				// Normalize content
				content = normalizeTextInput(content);

				// Extract categories based on assignment method
				let categories: string[] | undefined;
				if (categoryAssignment === 'manual') {
					const categoriesParam = this.getNodeParameter('categories', itemIndex, '') as string;
					if (categoriesParam.trim()) {
						categories = categoriesParam
							.split(',')
							.map(cat => cat.trim())
							.filter(cat => cat.length > 0);
					}
				} else if (categoryAssignment === 'input') {
					const categoriesField = this.getNodeParameter('categoriesField', itemIndex) as string;
					const categoriesData = inputItem.json[categoriesField];
					
					if (Array.isArray(categoriesData)) {
						categories = categoriesData.map(cat => String(cat).trim()).filter(cat => cat.length > 0);
					} else if (typeof categoriesData === 'string') {
						categories = categoriesData
							.split(',')
							.map(cat => cat.trim())
							.filter(cat => cat.length > 0);
					}
				}
				// For 'auto' assignment, categories remains undefined

				// Extract user context
				const userContext = extractUserContext(inputItem, userScoping);

				// Validate parameters
				const validationResult = validateInputParameters({
					content,
					memoryType,
					categories,
					userContext,
				});

				if (!validationResult.isValid) {
					throw new NodeOperationError(
						this.getNode(),
						`Invalid parameters for item ${itemIndex}: ${validationResult.errors.join(', ')}`,
					);
				}

				// Prepare create parameters
				const createParams: CreateItemParams = {
					memory_type: memoryType as any,
					content,
					categories,
					user: userContext,
				};

				// Call MemU API
				const response = await memUClient.createItem(createParams);

				// Check if creation was successful
				if (!response.success) {
					throw new NodeOperationError(
						this.getNode(),
						`Failed to create memory item: ${response.message || 'Unknown error'}`,
					);
				}

				// Transform response to n8n format
				const outputData = transformMemUResponse(response, 'create', inputItem.json);

				// Add additional metadata
				const memuData = (outputData.json.memu as Record<string, any>) || {};
				outputData.json.memu = {
					...memuData,
					memory_type: memoryType,
					content_length: content.length,
					categories_assigned: categories || [],
					user_context: userContext || null,
					creation_options: {
						validate_content: additionalOptions.validateContent,
						skip_duplicates: additionalOptions.skipDuplicates,
						auto_summarize: additionalOptions.autoSummarize,
					},
				};

				returnData.push(outputData);

			} catch (error) {
				// Handle errors gracefully
				const errorOutput = handleMemUError(error, inputItem.json);
				returnData.push(errorOutput);
			}
		}

		return [returnData];
	}
}