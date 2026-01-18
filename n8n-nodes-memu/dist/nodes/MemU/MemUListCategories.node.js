"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemUListCategories = void 0;
const n8n_workflow_1 = require("n8n-workflow");
const MemUClient_1 = require("./shared/MemUClient");
const utils_1 = require("./shared/utils");
class MemUListCategories {
    constructor() {
        this.description = {
            displayName: 'MemU List Categories',
            name: 'memUListCategories',
            icon: 'file:memu.svg',
            group: ['input'],
            version: 1,
            subtitle: 'List memory categories',
            description: 'List all memory categories for a user/agent combination',
            defaults: {
                name: 'MemU List Categories',
            },
            inputs: ['main'],
            outputs: ['main'],
            credentials: [
                {
                    name: 'memUCloudApi',
                    required: true,
                },
            ],
            properties: [
                {
                    displayName: 'User ID',
                    name: 'userId',
                    type: 'string',
                    default: '',
                    placeholder: 'user_123',
                    description: 'Unique identifier for the user (required)',
                    required: true,
                },
                {
                    displayName: 'Agent ID',
                    name: 'agentId',
                    type: 'string',
                    default: '',
                    placeholder: 'agent_456',
                    description: 'Unique identifier for the AI agent (required)',
                    required: true,
                },
                {
                    displayName: 'Advanced Options',
                    name: 'advancedOptions',
                    type: 'collection',
                    placeholder: 'Add Option',
                    default: {},
                    options: [
                        {
                            displayName: 'Request Timeout (Seconds)',
                            name: 'timeout',
                            type: 'number',
                            default: 30,
                            description: 'HTTP request timeout in seconds',
                        },
                    ],
                },
            ],
        };
    }
    async execute() {
        var _a;
        const items = this.getInputData();
        const returnData = [];
        // Get parameters
        const userId = this.getNodeParameter('userId', 0);
        const agentId = this.getNodeParameter('agentId', 0);
        const advancedOptions = this.getNodeParameter('advancedOptions', 0, {});
        // Validate required fields
        if (!userId) {
            throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'User ID is required');
        }
        if (!agentId) {
            throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Agent ID is required');
        }
        // Get credentials
        let credentials;
        try {
            credentials = await this.getCredentials('memUCloudApi');
        }
        catch {
            throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'MemU Cloud API credentials are required for listing categories.');
        }
        // Create MemU client
        const memUClient = new MemUClient_1.MemUClient(credentials, {
            timeout: (advancedOptions.timeout || 30) * 1000,
        });
        // Process each input item (or single operation if no input data)
        const inputItems = items.length > 0 ? items : [{ json: {} }];
        for (let itemIndex = 0; itemIndex < inputItems.length; itemIndex++) {
            const inputItem = inputItems[itemIndex];
            try {
                // Call MemU API to list categories
                const response = await memUClient.listCategories({
                    user_id: userId,
                    agent_id: agentId,
                });
                // Transform response to n8n format
                const outputData = (0, utils_1.transformMemUResponse)(response, 'list', inputItem.json);
                // Add additional metadata
                outputData.json.memu = {
                    ...(outputData.json.memu || {}),
                    user_id: userId,
                    agent_id: agentId,
                    categories: response.categories,
                    total_count: ((_a = response.categories) === null || _a === void 0 ? void 0 : _a.length) || 0,
                };
                returnData.push(outputData);
            }
            catch (error) {
                const errorOutput = (0, utils_1.handleMemUError)(error, inputItem.json);
                returnData.push(errorOutput);
            }
        }
        return [returnData];
    }
}
exports.MemUListCategories = MemUListCategories;
