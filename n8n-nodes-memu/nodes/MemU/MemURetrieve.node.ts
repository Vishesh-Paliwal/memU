import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';

export class MemURetrieve implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'MemU Retrieve',
		name: 'memURetrieve',
		icon: 'file:memu.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["method"] + " retrieval"}}',
		description: 'Query and retrieve relevant memories from MemU',
		defaults: {
			name: 'MemU Retrieve',
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
			// Properties will be implemented in task 4.2
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		// Implementation will be added in task 4.2
		throw new NodeOperationError(this.getNode(), 'MemU Retrieve node not yet implemented');
	}
}