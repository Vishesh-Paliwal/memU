import {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class MemUSelfHostedApi implements ICredentialType {
	name = 'memUSelfHostedApi';
	displayName = 'MemU Self-hosted API';
	documentationUrl = 'https://memu.so/docs';
	properties: INodeProperties[] = [
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'http://localhost:8000',
			required: true,
			description: 'Your self-hosted MemU instance URL',
		},
		{
			displayName: 'Authentication Method',
			name: 'authMethod',
			type: 'options',
			options: [
				{ name: 'API Key', value: 'apiKey' },
				{ name: 'None', value: 'none' },
			],
			default: 'apiKey',
			description: 'Authentication method for your self-hosted instance',
		},
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			displayOptions: {
				show: { authMethod: ['apiKey'] },
			},
			default: '',
			description: 'API key for authentication',
		},
	];

	// Use generic authentication with conditional API key
	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '={{$credentials.authMethod === "apiKey" ? "Bearer " + $credentials.apiKey : ""}}',
			},
		},
	};

	// Test the connection
	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl}}',
			url: '/health',
			method: 'GET',
		},
	};
}