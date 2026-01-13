import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	INodeProperties,
	NodeOperationError,
} from 'n8n-workflow';

import { MemUClient } from './shared/MemUClient';
import { MemorizeParams } from './shared/types';
import {
	extractUrlFromInput,
	validateInputParameters,
	handleMemUError,
	transformMemUResponse,
	extractUserContext,
	batchProcessInputData,
} from './shared/utils';

export class MemUMemorize implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'MemU Memorize',
		name: 'memUMemorize',
		icon: 'file:memu.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["resourceSource"] === "manual" ? $parameter["modality"] : "From Input: " + $parameter["modality"]}}',
		description: 'Extract and store structured memory from multimodal inputs',
		defaults: {
			name: 'MemU Memorize',
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
				displayName: 'Resource Source',
				name: 'resourceSource',
				type: 'options',
				options: [
					{ name: 'From Input', value: 'input' },
					{ name: 'Manual URL', value: 'manual' },
				],
				default: 'input',
				description: 'Source of the resource to memorize',
			},
			{
				displayName: 'Resource URL',
				name: 'resourceUrl',
				type: 'string',
				displayOptions: {
					show: { resourceSource: ['manual'] },
				},
				default: '',
				placeholder: 'https://example.com/document.pdf',
				description: 'URL or path to the resource to memorize',
				required: true,
			},
			{
				displayName: 'Resource URL Field',
				name: 'resourceUrlField',
				type: 'string',
				displayOptions: {
					show: { resourceSource: ['input'] },
				},
				default: 'url',
				description: 'Field name containing the resource URL in input data',
				required: true,
			},
			{
				displayName: 'Modality',
				name: 'modality',
				type: 'options',
				options: [
					{ name: 'Audio', value: 'audio' },
					{ name: 'Conversation', value: 'conversation' },
					{ name: 'Document', value: 'document' },
					{ name: 'Image', value: 'image' },
					{ name: 'Video', value: 'video' },
				],
				default: 'document',
				description: 'Type of content being memorized',
				required: true,
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
						description: 'Session identifier for grouping related memories',
					},
				],
				description: 'User context for scoped memory storage',
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
				],
			},
		] as INodeProperties[],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const resourceSource = this.getNodeParameter('resourceSource', 0) as string;
		const modality = this.getNodeParameter('modality', 0) as string;
		const userScoping = this.getNodeParameter('userScoping', 0, {}) as Record<string, any>;
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
				// Get resource URL based on source
				let resourceUrl: string;
				if (resourceSource === 'manual') {
					resourceUrl = this.getNodeParameter('resourceUrl', index) as string;
				} else {
					const resourceUrlField = this.getNodeParameter('resourceUrlField', index) as string;
					resourceUrl = item.json[resourceUrlField] as string;
				}

				// Validate input parameters
				const validationResult = validateInputParameters({
					resourceUrl,
					modality,
					operation: 'memorize',
				});

				if (!validationResult.isValid) {
					throw new NodeOperationError(
						this.getNode(),
						`Validation failed: ${validationResult.errors.join(', ')}`,
					);
				}

				// Extract user context
				const userContext = extractUserContext(item, userScoping);

				// Prepare memorize parameters
				const memorizeParams: MemorizeParams = {
					resourceUrl,
					modality: modality as 'conversation' | 'document' | 'image' | 'video' | 'audio',
					user: userContext,
				};

				// Call MemU API
				const response = await memUClient.memorize(memorizeParams);

				// Transform response to n8n format
				return transformMemUResponse(response, 'memorize', item.json);
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