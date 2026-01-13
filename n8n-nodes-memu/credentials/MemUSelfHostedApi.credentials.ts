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
			description: 'Your self-hosted MemU instance URL. Include the protocol (http:// or https://) and port if needed.',
			placeholder: 'http://localhost:8000',
			typeOptions: {
				validation: [
					{
						type: 'regex',
						properties: {
							regex: '^https?://[a-zA-Z0-9.-]+(?:\\.[a-zA-Z]{2,})?(?::[0-9]+)?(?:/.*)?$',
							errorMessage: 'Please enter a valid URL (e.g., http://localhost:8000 or https://memu.example.com)',
						},
					},
				],
			},
		},
		{
			displayName: 'Authentication Method',
			name: 'authMethod',
			type: 'options',
			options: [
				{ 
					name: 'API Key', 
					value: 'apiKey',
					description: 'Use API key authentication (recommended for production)'
				},
				{ 
					name: 'None', 
					value: 'none',
					description: 'No authentication (only for development/testing)'
				},
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
			required: true,
			description: 'API key for authentication. This should be configured in your self-hosted MemU instance.',
			placeholder: 'your-api-key-here',
		},
	];

	// Use generic authentication with conditional API key
	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '={{$credentials.authMethod === "apiKey" ? "Bearer " + $credentials.apiKey : undefined}}',
				'Content-Type': 'application/json',
				'User-Agent': 'n8n-memu-adapter/1.0.0',
			},
		},
	};

	// Test the connection by calling the health endpoint
	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl}}',
			url: '/health',
			method: 'GET',
			timeout: 10000,
		},
		rules: [
			{
				type: 'responseSuccessBody',
				properties: {
					key: 'status',
					value: 'ok',
					message: 'Connection test successful! Self-hosted MemU instance is accessible.',
				},
			},
		],
	};
}