import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';

export class MemUCreateItem implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'MemU Create Item',
		name: 'memUCreateItem',
		icon: 'file:memu.svg',
		group: ['output'],
		version: 1,
		subtitle: '={{$parameter["memoryType"]}}',
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
			// Properties will be implemented in task 5.2
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		// Implementation will be added in task 5.2
		throw new NodeOperationError(this.getNode(), 'MemU Create Item node not yet implemented');
	}
}