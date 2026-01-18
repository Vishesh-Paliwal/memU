import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';

import { MemUClient } from './shared/MemUClient';
import { handleMemUError, transformMemUResponse } from './shared/utils';

export class MemUListCategories implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'MemU List Categories',
		name: 'memUListCategories',
		icon: 'file:memu.svg',
		group: ['input'],
		version: 1,
		subtitle: 'List memory categories',
		description: 'List all memory categories for a user/agent combination',
		defaults: {
			name: 'MemU List Categories',
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
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		// Get parameters
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
				'MemU Cloud API credentials are required for listing categories.',
			);
		}

		// Create MemU client
		const memUClient = new MemUClient(credentials, {
			timeout: (advancedOptions.timeout || 30) * 1000,
		});

		// Process each input item (or single operation if no input data)
		const inputItems = items.length > 0 ? items : [{ json: {} }];

		for (let itemIndex = 0; itemIndex < inputItems.length; itemIndex++) {
			const inputItem = inputItems[itemIndex];

			try {
				// Call MemU API to list categories
				const response = await memUClient.listCategories({
					user_id: userId,
					agent_id: agentId,
				});

				// Transform response to n8n format
				const outputData = transformMemUResponse(response, 'list', inputItem.json);

				// Add additional metadata
				outputData.json.memu = {
					...(outputData.json.memu as Record<string, any> || {}),
					user_id: userId,
					agent_id: agentId,
					categories: response.categories,
					total_count: response.categories?.length || 0,
				};

				returnData.push(outputData);

			} catch (error) {
				const errorOutput = handleMemUError(error, inputItem.json);
				returnData.push(errorOutput);
			}
		}

		return [returnData];
	}
}
