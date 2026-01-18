"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemURetrieve = void 0;
const n8n_workflow_1 = require("n8n-workflow");
const MemUClient_1 = require("./shared/MemUClient");
const utils_1 = require("./shared/utils");
class MemURetrieve {
    constructor() {
        this.description = {
            displayName: 'MemU Retrieve',
            name: 'memURetrieve',
            icon: 'file:memu.svg',
            group: ['transform'],
            version: 1,
            subtitle: '={{$parameter["querySource"] === "manual" ? "Manual Query" : "From Input"}}',
            description: 'Query and retrieve relevant memories from MemU using semantic search',
            defaults: {
                name: 'MemU Retrieve',
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
                    displayName: 'Query Source',
                    name: 'querySource',
                    type: 'options',
                    options: [
                        { name: 'From Input', value: 'input' },
                        { name: 'Manual Query', value: 'manual' },
                    ],
                    default: 'input',
                    description: 'Source of the query text',
                },
                {
                    displayName: 'Query Text',
                    name: 'queryText',
                    type: 'string',
                    displayOptions: {
                        show: { querySource: ['manual'] },
                    },
                    default: '',
                    placeholder: 'What sports does the user enjoy?',
                    description: 'Natural language query to search memories',
                    required: true,
                },
                {
                    displayName: 'Query Field',
                    name: 'queryField',
                    type: 'string',
                    displayOptions: {
                        show: { querySource: ['input'] },
                    },
                    default: 'query',
                    description: 'Field name containing the query text in input data',
                    required: true,
                },
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
                    displayName: 'Query Format',
                    name: 'queryFormat',
                    type: 'options',
                    options: [
                        {
                            name: 'Simple String',
                            value: 'string',
                            description: 'Send query as a simple string',
                        },
                        {
                            name: 'Message List (with Query Rewriting)',
                            value: 'messages',
                            description: 'Send as message list for context-aware query rewriting',
                        },
                    ],
                    default: 'string',
                    description: 'Format for sending the query. Message list enables automatic query rewriting based on conversation context.',
                },
                {
                    displayName: 'Context Messages',
                    name: 'contextMessages',
                    type: 'fixedCollection',
                    typeOptions: {
                        multipleValues: true,
                    },
                    displayOptions: {
                        show: { queryFormat: ['messages'] },
                    },
                    default: { messages: [] },
                    options: [
                        {
                            name: 'messages',
                            displayName: 'Context Message',
                            values: [
                                {
                                    displayName: 'Role',
                                    name: 'role',
                                    type: 'options',
                                    options: [
                                        { name: 'User', value: 'user' },
                                        { name: 'Assistant', value: 'assistant' },
                                    ],
                                    default: 'user',
                                    description: 'Role of the message sender',
                                },
                                {
                                    displayName: 'Content',
                                    name: 'content',
                                    type: 'string',
                                    default: '',
                                    description: 'Message content for context',
                                    required: true,
                                },
                            ],
                        },
                    ],
                    description: 'Previous conversation context for query rewriting. The last message is used as the query.',
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
                        {
                            displayName: 'Continue on Error',
                            name: 'continueOnError',
                            type: 'boolean',
                            default: false,
                            description: 'Whether to continue processing other items if one fails',
                        },
                    ],
                },
            ],
        };
    }
    async execute() {
        const items = this.getInputData();
        const querySource = this.getNodeParameter('querySource', 0);
        const queryFormat = this.getNodeParameter('queryFormat', 0);
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
            throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'MemU Cloud API credentials are required.');
        }
        if (!credentials) {
            throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'No MemU credentials configured. Please add MemU Cloud API credentials.');
        }
        // Create MemU client
        const memUClient = new MemUClient_1.MemUClient(credentials, {
            timeout: (advancedOptions.timeout || 30) * 1000,
        });
        // Process items
        const results = await (0, utils_1.batchProcessInputData)(items, async (item, index) => {
            var _a;
            // Get query text based on source
            let queryText;
            if (querySource === 'manual') {
                queryText = this.getNodeParameter('queryText', index);
            }
            else {
                const queryField = this.getNodeParameter('queryField', index);
                queryText = item.json[queryField];
            }
            // Normalize query text
            queryText = (0, utils_1.normalizeTextInput)(queryText);
            if (!queryText) {
                throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Query text is required');
            }
            // Prepare query - either as string or message list
            let query;
            if (queryFormat === 'messages') {
                const contextMessages = this.getNodeParameter('contextMessages', index, { messages: [] });
                // Build message list with context + query
                query = [];
                if (((_a = contextMessages.messages) === null || _a === void 0 ? void 0 : _a.length) > 0) {
                    for (const msg of contextMessages.messages) {
                        query.push({
                            role: msg.role,
                            content: { text: msg.content },
                        });
                    }
                }
                // Add the main query as the last message
                query.push({
                    role: 'user',
                    content: { text: queryText },
                });
            }
            else {
                query = queryText;
            }
            // Prepare retrieve parameters
            const retrieveParams = {
                user_id: userId,
                agent_id: agentId,
                query,
            };
            // Call MemU API
            const response = await memUClient.retrieve(retrieveParams);
            // Transform response to n8n format
            return (0, utils_1.transformMemUResponse)(response, 'retrieve', item.json);
        }, {
            continueOnError: advancedOptions.continueOnError || false,
            maxConcurrency: 3,
        });
        // Process results and create output
        const outputData = [];
        for (const result of results) {
            if (result.success && result.result) {
                outputData.push(result.result);
            }
            else if (result.error) {
                const errorOutput = (0, utils_1.handleMemUError)(new Error(result.error), result.originalData);
                outputData.push(errorOutput);
            }
        }
        return [outputData];
    }
}
exports.MemURetrieve = MemURetrieve;
