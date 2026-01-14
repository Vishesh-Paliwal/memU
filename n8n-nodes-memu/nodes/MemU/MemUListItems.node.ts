import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';

import { MemUClient } from './shared/MemUClient';
import { ListItemsParams, NodeCredentials } from './shared/types';
import { handleMemUError, transformMemUResponse, validateInputParameters } from './shared/utils';

export class MemUListItems implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'MemU List Items',
		name: 'memUListItems',
		icon: 'file:memu.svg',
		group: ['input'],
		version: 1,
		subtitle: '={{$parameter["listType"]}}',
		description: 'List and browse stored memories',
		defaults: {
			name: 'MemU List Items',
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
				displayName: 'List Type',
				name: 'listType',
				type: 'options',
				options: [
					{
						name: 'Memory Items',
						value: 'items',
						description: 'List all memory items with optional filtering',
					},
					{
						name: 'Memory Categories',
						value: 'categories',
						description: 'List all memory categories with summaries',
					},
				],
				default: 'items',
				description: 'Type of memories to list',
			},
			{
				displayName: 'User Scope Filters',
				name: 'userFilters',
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
				],
				description: 'Filters to limit results to specific users or contexts',
			},
			{
				displayName: 'Additional Options',
				name: 'additionalOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Limit',
						name: 'limit',
						type: 'number',
						default: 100,
						description: 'Maximum number of items to return',
					},
					{
						displayName: 'Include Empty Results',
						name: 'includeEmpty',
						type: 'boolean',
						default: true,
						description: 'Return empty result set when no memories exist',
					},
					{
						displayName: 'Sort By',
						name: 'sortBy',
						type: 'options',
						options: [
							{
								name: 'Created Date (Newest First)',
								value: 'created_desc',
							},
							{
								name: 'Created Date (Oldest First)',
								value: 'created_asc',
							},
							{
								name: 'Updated Date (Newest First)',
								value: 'updated_desc',
							},
							{
								name: 'Updated Date (Oldest First)',
								value: 'updated_asc',
							},
							{
								name: 'Name (A-Z)',
								value: 'name_asc',
							},
							{
								name: 'Name (Z-A)',
								value: 'name_desc',
							},
						],
						default: 'created_desc',
						description: 'Sort order for results',
					},
					{
						displayName: 'Search Query',
						name: 'searchQuery',
						type: 'string',
						default: '',
						placeholder: 'Search in memory content...',
						description: 'Search for specific content in memories',
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

		// Get node parameters
		const listType = this.getNodeParameter('listType', 0) as 'items' | 'categories';
		const userFilters = this.getNodeParameter('userFilters', 0, {}) as Record<string, any>;
		const additionalOptions = this.getNodeParameter('additionalOptions', 0, {}) as Record<string, any>;

		// Validate parameters
		const validationResult = validateInputParameters({
			listType,
			userFilters,
			...additionalOptions,
		});

		if (!validationResult.isValid) {
			throw new NodeOperationError(
				this.getNode(),
				`Invalid parameters: ${validationResult.errors.join(', ')}`,
			);
		}

		// Create MemU client
		const credentialData = credentials.memUCloudApi || credentials.memUSelfHostedApi;
		const memUClient = new MemUClient(credentialData!);

		// Process each input item (or single operation if no input data)
		const inputItems = items.length > 0 ? items : [{ json: {} }];

		for (let itemIndex = 0; itemIndex < inputItems.length; itemIndex++) {
			const inputItem = inputItems[itemIndex];

			try {
				// Prepare list parameters
				const listParams: ListItemsParams = {
					listType,
					userFilters: Object.keys(userFilters).length > 0 ? userFilters : undefined,
					limit: additionalOptions.limit,
					includeEmpty: additionalOptions.includeEmpty,
				};

				// Add search and sort parameters if supported by API
				const extendedParams = {
					...listParams,
					sortBy: additionalOptions.sortBy,
					searchQuery: additionalOptions.searchQuery,
				};

				// Call MemU API
				const response = await memUClient.listItems(listParams);

				// Handle empty results
				if (!additionalOptions.includeEmpty && 
					(!response.items || response.items.length === 0) && 
					(!response.categories || response.categories.length === 0)) {
					continue; // Skip empty results if not including them
				}

				// Transform response to n8n format
				const outputData = transformMemUResponse(response, 'list', inputItem.json);

				// Add additional metadata
				const memuData = (outputData.json.memu as Record<string, any>) || {};
				outputData.json.memu = {
					...memuData,
					list_type: listType,
					filters_applied: userFilters,
					search_query: additionalOptions.searchQuery || null,
					sort_by: additionalOptions.sortBy || null,
					total_count: response.total_count,
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