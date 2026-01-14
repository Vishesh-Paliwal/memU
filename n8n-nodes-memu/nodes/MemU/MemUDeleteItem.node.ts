import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';

import { MemUClient } from './shared/MemUClient';
import { DeleteItemParams, NodeCredentials } from './shared/types';
import { 
	handleMemUError, 
	transformMemUResponse, 
	validateInputParameters,
	batchProcessInputData
} from './shared/utils';

/**
 * Check if deletion is properly confirmed
 */
function checkDeletionConfirmation(
	executeFunctions: IExecuteFunctions,
	inputItem: INodeExecutionData,
	confirmation: Record<string, any>,
	itemIndex: number,
): boolean {
	if (!confirmation.requireConfirmation) {
		return true;
	}

	// For manual entry, check confirmation value
	const idSource = executeFunctions.getNodeParameter('idSource', itemIndex) as string;
	if (idSource === 'manual') {
		const confirmationValue = confirmation.confirmationValue as string;
		return !!(confirmationValue && confirmationValue.toLowerCase() === 'delete');
	}

	// For input data, check confirmation field
	const confirmationField = confirmation.confirmationField || 'confirm_delete';
	const confirmValue = inputItem.json[confirmationField];
	
	if (typeof confirmValue === 'boolean') {
		return confirmValue;
	}
	
	if (typeof confirmValue === 'string') {
		const normalizedValue = confirmValue.toLowerCase().trim();
		return normalizedValue === 'true' || normalizedValue === 'yes' || normalizedValue === 'delete';
	}

	return false;
}

/**
 * Process batch deletion of multiple items
 */
async function processBatchDeletion(
	executeFunctions: IExecuteFunctions,
	items: INodeExecutionData[],
	memUClient: MemUClient,
	confirmation: Record<string, any>,
	deletionOptions: Record<string, any>,
	batchProcessing: Record<string, any>,
): Promise<INodeExecutionData[][]> {
	const returnData: INodeExecutionData[] = [];

	for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
		const inputItem = items[itemIndex];

		try {
			// Extract batch IDs
			const batchIdsField = executeFunctions.getNodeParameter('batchIdsField', itemIndex) as string;
			const itemIdField = executeFunctions.getNodeParameter('itemIdField', itemIndex) as string;
			
			let itemIds: string[] = [];
			
			// Try to get IDs from batch field first
			if (batchIdsField && inputItem.json[batchIdsField]) {
				const batchIds = inputItem.json[batchIdsField];
				if (Array.isArray(batchIds)) {
					itemIds = batchIds.map(id => String(id).trim()).filter(id => id.length > 0);
				}
			}
			
			// If no batch IDs, try single ID field
			if (itemIds.length === 0 && inputItem.json[itemIdField]) {
				const singleId = String(inputItem.json[itemIdField]).trim();
				if (singleId.length > 0) {
					itemIds = [singleId];
				}
			}

			if (itemIds.length === 0) {
				throw new NodeOperationError(
					executeFunctions.getNode(),
					`No item IDs found for batch deletion (item ${itemIndex})`,
				);
			}

			// Check confirmation if required
			if (confirmation.requireConfirmation) {
				const isConfirmed = checkDeletionConfirmation(
					executeFunctions,
					inputItem,
					confirmation,
					itemIndex,
				);
				
				if (!isConfirmed) {
					throw new NodeOperationError(
						executeFunctions.getNode(),
						`Batch deletion not confirmed for item ${itemIndex}. Please provide proper confirmation.`,
					);
				}
			}

			// Process batch deletion
			const batchResults = await batchProcessInputData(
				itemIds.map(id => ({ json: { id } })),
				async (idItem) => {
					if (deletionOptions.dryRun) {
						return {
							success: true,
							dry_run: true,
							item_id: String(idItem.json.id),
							would_delete: true,
						};
					}

					const response = await memUClient.deleteItem({ id: String(idItem.json.id) });
					return {
						...response,
						item_id: String(idItem.json.id),
					};
				},
				{
					maxConcurrency: batchProcessing.maxConcurrency || 5,
					continueOnError: deletionOptions.continueOnError !== false,
				},
			);

			// Create batch summary
			const successful = batchResults.filter(r => r.success);
			const failed = batchResults.filter(r => !r.success);

			const batchOutput = {
				json: {
					...inputItem.json,
					memu: {
						operation: 'batch_delete',
						dry_run: deletionOptions.dryRun || false,
						total_items: itemIds.length,
						successful_deletions: successful.length,
						failed_deletions: failed.length,
						results: batchResults,
						timestamp: new Date().toISOString(),
					},
				},
			};

			returnData.push(batchOutput);

		} catch (error) {
			// Handle errors gracefully
			if (deletionOptions.continueOnError) {
				const errorOutput = handleMemUError(error, inputItem.json);
				returnData.push(errorOutput);
			} else {
				throw error;
			}
		}
	}

	return [returnData];
}

export class MemUDeleteItem implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'MemU Delete Item',
		name: 'memUDeleteItem',
		icon: 'file:memu.svg',
		group: ['output'],
		version: 1,
		subtitle: 'Delete memory item',
		description: 'Delete memory items',
		defaults: {
			name: 'MemU Delete Item',
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
					{
						name: 'Batch from Input',
						value: 'batch',
						description: 'Delete multiple items from input data array',
					},
				],
				default: 'input',
				description: 'Source of the memory item ID(s) to delete',
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
				description: 'The ID of the memory item to delete',
				required: true,
			},
			{
				displayName: 'Item ID Field',
				name: 'itemIdField',
				type: 'string',
				displayOptions: {
					show: {
						idSource: ['input', 'batch'],
					},
				},
				default: 'id',
				description: 'Field name containing the item ID in input data',
				required: true,
			},
			{
				displayName: 'Batch IDs Field',
				name: 'batchIdsField',
				type: 'string',
				displayOptions: {
					show: {
						idSource: ['batch'],
					},
				},
				default: 'ids',
				description: 'Field name containing array of item IDs for batch deletion',
			},
			{
				displayName: 'Confirmation',
				name: 'confirmation',
				type: 'collection',
				placeholder: 'Add Confirmation Setting',
				default: {},
				options: [
					{
						displayName: 'Require Confirmation',
						name: 'requireConfirmation',
						type: 'boolean',
						default: true,
						description: 'Require explicit confirmation before deletion',
					},
					{
						displayName: 'Confirmation Field',
						name: 'confirmationField',
						type: 'string',
						default: 'confirm_delete',
						description: 'Field name that must contain "true" or "yes" to confirm deletion',
					},
					{
						displayName: 'Confirmation Value',
						name: 'confirmationValue',
						type: 'string',
						default: '',
						placeholder: 'Type "DELETE" to confirm',
						description: 'Value that confirms the deletion (case-insensitive)',
					},
				],
				description: 'Safety mechanisms for deletion confirmation',
			},
			{
				displayName: 'Deletion Options',
				name: 'deletionOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Fail on Not Found',
						name: 'failOnNotFound',
						type: 'boolean',
						default: false,
						description: 'Fail execution if item ID is not found',
					},
					{
						displayName: 'Continue on Error',
						name: 'continueOnError',
						type: 'boolean',
						default: true,
						description: 'Continue processing other items if one deletion fails',
					},
					{
						displayName: 'Return Deleted Item Info',
						name: 'returnDeletedInfo',
						type: 'boolean',
						default: true,
						description: 'Include information about deleted items in response',
					},
					{
						displayName: 'Cascade Delete',
						name: 'cascadeDelete',
						type: 'boolean',
						default: false,
						description: 'Also delete related items and references',
					},
					{
						displayName: 'Dry Run',
						name: 'dryRun',
						type: 'boolean',
						default: false,
						description: 'Simulate deletion without actually deleting (for testing)',
					},
				],
			},
			{
				displayName: 'Batch Processing',
				name: 'batchProcessing',
				type: 'collection',
				placeholder: 'Add Batch Option',
				default: {},
				displayOptions: {
					show: {
						idSource: ['batch'],
					},
				},
				options: [
					{
						displayName: 'Max Concurrent Deletions',
						name: 'maxConcurrency',
						type: 'number',
						default: 5,
						description: 'Maximum number of concurrent deletion operations',
					},
					{
						displayName: 'Batch Size',
						name: 'batchSize',
						type: 'number',
						default: 10,
						description: 'Number of items to process in each batch',
					},
					{
						displayName: 'Delay Between Batches',
						name: 'delayBetweenBatches',
						type: 'number',
						default: 100,
						description: 'Delay in milliseconds between batch operations',
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

		// Get common parameters
		const idSource = this.getNodeParameter('idSource', 0) as string;
		const confirmation = this.getNodeParameter('confirmation', 0, {}) as Record<string, any>;
		const deletionOptions = this.getNodeParameter('deletionOptions', 0, {}) as Record<string, any>;

		// Handle batch processing
		if (idSource === 'batch') {
			const batchProcessing = this.getNodeParameter('batchProcessing', 0, {}) as Record<string, any>;
			return await processBatchDeletion(
				this,
				items,
				memUClient,
				confirmation,
				deletionOptions,
				batchProcessing,
			);
		}

		// Process each input item for single deletions
		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			const inputItem = items[itemIndex];

			try {
				// Extract item ID based on source
				let itemId: string;
				if (idSource === 'manual') {
					itemId = this.getNodeParameter('itemId', itemIndex) as string;
				} else {
					const itemIdField = this.getNodeParameter('itemIdField', itemIndex) as string;
					itemId = String(inputItem.json[itemIdField] || '');
				}

				// Validate required fields
				if (!itemId || itemId.trim() === '') {
					throw new NodeOperationError(
						this.getNode(),
						`Item ID is required for memory item deletion (item ${itemIndex})`,
					);
				}

				// Check confirmation if required
				if (confirmation.requireConfirmation) {
					const isConfirmed = checkDeletionConfirmation(
						this,
						inputItem,
						confirmation,
						itemIndex,
					);
					
					if (!isConfirmed) {
						throw new NodeOperationError(
							this.getNode(),
							`Deletion not confirmed for item ${itemIndex}. Please provide proper confirmation.`,
						);
					}
				}

				// Handle dry run
				if (deletionOptions.dryRun) {
					const dryRunOutput = {
						json: {
							...inputItem.json,
							memu: {
								operation: 'delete',
								dry_run: true,
								item_id: itemId.trim(),
								would_delete: true,
								timestamp: new Date().toISOString(),
							},
						},
					};
					returnData.push(dryRunOutput);
					continue;
				}

				// Prepare delete parameters
				const deleteParams: DeleteItemParams = {
					id: itemId.trim(),
				};

				// Validate parameters
				const validationResult = validateInputParameters({
					itemId: deleteParams.id,
				});

				if (!validationResult.isValid) {
					throw new NodeOperationError(
						this.getNode(),
						`Invalid parameters for item ${itemIndex}: ${validationResult.errors.join(', ')}`,
					);
				}

				// Call MemU API
				const response = await memUClient.deleteItem(deleteParams);

				// Check if deletion was successful
				if (!response.success) {
					const errorMessage = response.message || 'Unknown error';
					
					if (errorMessage.includes('not found') && !deletionOptions.failOnNotFound) {
						// Skip this item if not found and failOnNotFound is false
						console.log(`Memory item ${itemId} not found, skipping deletion`);
						
						const notFoundOutput = {
							json: {
								...inputItem.json,
								memu: {
									operation: 'delete',
									item_id: itemId,
									success: false,
									skipped: true,
									reason: 'Item not found',
									timestamp: new Date().toISOString(),
								},
							},
						};
						returnData.push(notFoundOutput);
						continue;
					}
					
					throw new NodeOperationError(
						this.getNode(),
						`Failed to delete memory item ${itemId}: ${errorMessage}`,
					);
				}

				// Transform response to n8n format
				const outputData = transformMemUResponse(response, 'delete', inputItem.json);

				// Add additional metadata
				const memuData = (outputData.json.memu as Record<string, any>) || {};
				outputData.json.memu = {
					...memuData,
					deleted_item_id: itemId,
					cascade_delete: deletionOptions.cascadeDelete,
					deletion_confirmed: confirmation.requireConfirmation || false,
					return_deleted_info: deletionOptions.returnDeletedInfo,
				};

				returnData.push(outputData);

			} catch (error) {
				// Handle errors gracefully
				if (deletionOptions.continueOnError) {
					const errorOutput = handleMemUError(error, inputItem.json);
					returnData.push(errorOutput);
				} else {
					throw error;
				}
			}
		}

		return [returnData];
	}
}