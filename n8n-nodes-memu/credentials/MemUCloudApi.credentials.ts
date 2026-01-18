import {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class MemUCloudApi implements ICredentialType {
	name = 'memUCloudApi';
	displayName = 'MemU Cloud API';
	documentationUrl = 'https://memu.so/docs';
	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description: 'Your MemU Cloud API key. You can find this in your MemU Cloud dashboard.',
			placeholder: 'memu_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://api.memu.so',
			required: true,
			description: 'MemU Cloud API base URL. Use the default unless instructed otherwise.',
			placeholder: 'https://api.memu.so',
			typeOptions: {
				validation: [
					{
						type: 'regex',
						properties: {
							regex: '^https?://[a-zA-Z0-9.-]+(?:\\.[a-zA-Z]{2,})?(?::[0-9]+)?(?:/.*)?$',
							errorMessage: 'Please enter a valid URL (e.g., https://api.memu.so)',
						},
					},
				],
			},
		},
	];

	// Use generic authentication with Bearer token
	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
				'Content-Type': 'application/json',
				'User-Agent': 'n8n-memu-adapter/1.0.0',
			},
		},
	};

	// Test the connection - just verify we can reach the API
	// Note: MemU Cloud may not have a dedicated health endpoint
	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl}}',
			url: '/',
			method: 'GET',
			timeout: 10000,
		},
	};
}