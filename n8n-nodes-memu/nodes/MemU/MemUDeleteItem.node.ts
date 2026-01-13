import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';

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
			// Properties will be implemented in task 5.4
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		// Implementation will be added in task 5.4
		throw new NodeOperationError(this.getNode(), 'MemU Delete Item node not yet implemented');
	}
}