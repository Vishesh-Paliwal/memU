import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';

export class MemUMemorize implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'MemU Memorize',
		name: 'memUMemorize',
		icon: 'file:memu.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["modality"]}}',
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
			// Properties will be implemented in task 4.1
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		// Implementation will be added in task 4.1
		throw new NodeOperationError(this.getNode(), 'MemU Memorize node not yet implemented');
	}
}