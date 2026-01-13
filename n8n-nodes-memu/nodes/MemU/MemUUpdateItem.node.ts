import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';

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
			// Properties will be implemented in task 5.3
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		// Implementation will be added in task 5.3
		throw new NodeOperationError(this.getNode(), 'MemU Update Item node not yet implemented');
	}
}