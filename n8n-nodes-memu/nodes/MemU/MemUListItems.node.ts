import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';

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
			// Properties will be implemented in task 5.1
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		// Implementation will be added in task 5.1
		throw new NodeOperationError(this.getNode(), 'MemU List Items node not yet implemented');
	}
}