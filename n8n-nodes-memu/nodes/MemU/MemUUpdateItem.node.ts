import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';

import { MemUClient } from './shared/MemUClient';
import { UpdateItemParams, NodeCredentials } from './shared/types';
import { 
	handleMemUError, 
	transformMemUResponse, 
	validateInputParameters,
	normalizeTextInput,
	isValidMemoryType
} from './shared/utils';

export class MemUUpdateItem implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'MemU Update Item',
		name: 'memUUpdateItem',
		icon: 'file:memu.svg',
		group: ['output'],
		version: 1,
		subtitle: 'Update memory item',
		description: 'Update existing memory items',
		defaults: {
			name: 'MemU Update Item',
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
				displayName: 'Item ID Source',
				name: 'idSource',
				type: 'options',
				options: [
					{
						name: 'From Input',
						value: 'input',
						description: 'Extract item ID from input data',
					},
					{
						name: 'Manual Entry',
						value: 'manual',
						description: 'Enter item ID manually',
					},
				],
				default: 'input',
				description: 'Source of the memory item ID to update',
			},
			{
				displayName: 'Item ID',
				name: 'itemId',
				type: 'string',
				displayOptions: {
					show: {
						idSource: ['manual'],
					},
				},
				default: '',
				placeholder: 'Enter memory item ID...',
				description: 'The ID of the memory item to update',
				required: true,
			},
			{
				displayName: 'Item ID Field',
				name: 'itemIdField',
				type: 'string',
				displayOptions: {
					show: {
						idSource: ['input'],
					},
				},
				default: 'id',
				description: 'Field name containing the item ID in input data',
				required: true,
			},
			{
				displayName: 'Update Fields',
				name: 'updateFields',
				type: 'collection',
				placeholder: 'Add Field to Update',
				default: {},
				options: [
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
						description: 'New memory type for the item',
					},
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
						description: 'Source of the new content',
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
						placeholder: 'Enter the new content...',
						description: 'The new content for the memory item',
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
						description: 'Field name containing the new content in input data',
					},
					{
						displayName: 'Categories Source',
						name: 'categoriesSource',
						type: 'options',
						options: [
							{
								name: 'From Input',
								value: 'input',
								description: 'Extract categories from input data',
							},
							{
								name: 'Manual Entry',
								value: 'manual',
								description: 'Enter categories manually',
							},
							{
								name: 'Keep Existing',
								value: 'keep',
								description: 'Keep existing categories unchanged',
							},
						],
						default: 'keep',
						description: 'Source of the new categories',
					},
					{
						displayName: 'Categories',
						name: 'categories',
						type: 'string',
						displayOptions: {
							show: {
								categoriesSource: ['manual'],
							},
						},
						default: '',
						placeholder: 'category1, category2, category3',
						description: 'Comma-separated list of new category names',
					},
					{
						displayName: 'Categories Field',
						name: 'categoriesField',
						type: 'string',
						displayOptions: {
							show: {
								categoriesSource: ['input'],
							},
						},
						default: 'categories',
						description: 'Field name containing categories in input data (array or comma-separated string)',
					},
				],
				description: 'Fields to update in the memory item',
			},
			{
				displayName: 'Update Options',
				name: 'updateOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Partial Update',
						name: 'partialUpdate',
						type: 'boolean',
						default: true,
						description: 'Only update specified fields, keep others unchanged',
					},
					{
						displayName: 'Validate Content',
						name: 'validateContent',
						type: 'boolean',
						default: true,
						description: 'Validate content before updating memory item',
					},
					{
						displayName: 'Auto-summarize',
						name: 'autoSummarize',
						type: 'boolean',
						default: true,
						description: 'Automatically regenerate summary for updated content',
					},
					{
						displayName: 'Fail on Not Found',
						name: 'failOnNotFound',
						type: 'boolean',
						default: true,
						description: 'Fail execution if item ID is not found',
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
				const idSource = this.getNodeParameter('idSource', itemIndex) as string;
				const updateFields = this.getNodeParameter('updateFields', itemIndex, {}) as Record<string, any>;
				const updateOptions = this.getNodeParameter('updateOptions', itemIndex, {}) as Record<string, any>;

				// Extract item ID based on source
				let itemId: string;
				if (idSource === 'manual') {
					itemId = this.getNodeParameter('itemId', itemIndex) as string;
				} else {
					const itemIdField = this.getNodeParameter('itemIdField', itemIndex) as string;
					itemId = inputItem.json[itemIdField] as string;
				}

				// Validate required fields
				if (!itemId || itemId.trim() === '') {
					throw new NodeOperationError(
						this.getNode(),
						`Item ID is required for memory item update (item ${itemIndex})`,
					);
				}

				// Check if there are any fields to update
				if (Object.keys(updateFields).length === 0) {
					throw new NodeOperationError(
						this.getNode(),
						`No update fields specified for item ${itemIndex}. Please specify at least one field to update.`,
					);
				}

				// Prepare update parameters
				const updateParams: UpdateItemParams = {
					id: itemId.trim(),
				};

				// Handle memory type update
				if (updateFields.memoryType) {
					if (!isValidMemoryType(updateFields.memoryType)) {
						throw new NodeOperationError(
							this.getNode(),
							`Invalid memory type: ${updateFields.memoryType}. Must be one of: behavior, event, knowledge, profile, skill`,
						);
					}
					updateParams.memory_type = updateFields.memoryType;
				}

				// Handle content update
				if (updateFields.contentSource) {
					let content: string | undefined;
					if (updateFields.contentSource === 'manual') {
						content = updateFields.content as string;
					} else if (updateFields.contentSource === 'input') {
						const contentField = updateFields.contentField || 'content';
						content = inputItem.json[contentField] as string;
					}

					if (content !== undefined) {
						if (!content || content.trim() === '') {
							throw new NodeOperationError(
								this.getNode(),
								`Content cannot be empty when updating memory item (item ${itemIndex})`,
							);
						}
						updateParams.content = normalizeTextInput(content);
					}
				}

				// Handle categories update
				if (updateFields.categoriesSource && updateFields.categoriesSource !== 'keep') {
					let categories: string[] | undefined;
					
					if (updateFields.categoriesSource === 'manual') {
						const categoriesParam = updateFields.categories as string;
						if (categoriesParam && categoriesParam.trim()) {
							categories = categoriesParam
								.split(',')
								.map(cat => cat.trim())
								.filter(cat => cat.length > 0);
						}
					} else if (updateFields.categoriesSource === 'input') {
						const categoriesField = updateFields.categoriesField || 'categories';
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

					updateParams.categories = categories;
				}

				// Validate parameters
				const validationResult = validateInputParameters({
					itemId: updateParams.id,
					memoryType: updateParams.memory_type,
					content: updateParams.content,
					categories: updateParams.categories,
				});

				if (!validationResult.isValid) {
					throw new NodeOperationError(
						this.getNode(),
						`Invalid parameters for item ${itemIndex}: ${validationResult.errors.join(', ')}`,
					);
				}

				// Call MemU API
				const response = await memUClient.updateItem(updateParams);

				// Check if update was successful
				if (!response.success) {
					const errorMessage = response.message || 'Unknown error';
					
					if (errorMessage.includes('not found') && !updateOptions.failOnNotFound) {
						// Skip this item if not found and failOnNotFound is false
						console.log(`Memory item ${itemId} not found, skipping update`);
						continue;
					}
					
					throw new NodeOperationError(
						this.getNode(),
						`Failed to update memory item ${itemId}: ${errorMessage}`,
					);
				}

				// Transform response to n8n format
				const outputData = transformMemUResponse(response, 'update', inputItem.json);

				// Add additional metadata
				const memuData = (outputData.json.memu as Record<string, any>) || {};
				outputData.json.memu = {
					...memuData,
					updated_item_id: itemId,
					updated_fields: Object.keys(updateParams).filter(key => key !== 'id'),
					update_options: {
						partial_update: updateOptions.partialUpdate,
						validate_content: updateOptions.validateContent,
						auto_summarize: updateOptions.autoSummarize,
						fail_on_not_found: updateOptions.failOnNotFound,
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