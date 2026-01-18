"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemUCloudApi = void 0;
class MemUCloudApi {
    constructor() {
        this.name = 'memUCloudApi';
        this.displayName = 'MemU Cloud API';
        this.documentationUrl = 'https://memu.so/docs';
        this.properties = [
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
        this.authenticate = {
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
        this.test = {
            request: {
                baseURL: '={{$credentials.baseUrl}}',
                url: '/',
                method: 'GET',
                timeout: 10000,
            },
        };
    }
}
exports.MemUCloudApi = MemUCloudApi;
