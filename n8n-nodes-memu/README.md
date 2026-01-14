# n8n-nodes-memu

[![npm version](https://badge.fury.io/js/n8n-nodes-memu.svg)](https://badge.fury.io/js/n8n-nodes-memu)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

This is an n8n community node package that integrates [MemU's](https://memu.so) agentic memory capabilities into n8n workflows. MemU is an agentic memory framework for LLM and AI agent backends that processes multimodal inputs (conversations, documents, images, videos, audio) into structured, retrievable memory.

## Table of Contents

- [Installation](#installation)
- [Nodes](#nodes)
- [Credentials](#credentials)
- [Configuration Examples](#configuration-examples)
- [Workflow Integration Patterns](#workflow-integration-patterns)
- [Troubleshooting](#troubleshooting)
- [FAQ](#faq)
- [Resources](#resources)
- [License](#license)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

### Community Nodes (Recommended)

1. Go to **Settings > Community Nodes**
2. Select **Install**
3. Enter `n8n-nodes-memu` in **Enter npm package name**
4. Agree to the [risks](https://docs.n8n.io/integrations/community-nodes/risks/) of using community nodes
5. Select **Install**

After installing, the nodes are available in the node panel under the "MemU" category.

### Manual Installation

For self-hosted n8n instances:

```bash
cd ~/.n8n/nodes
npm install n8n-nodes-memu
```

For Docker-based deployments, add to your Dockerfile:

```dockerfile
RUN cd /usr/local/lib/node_modules/n8n && npm install n8n-nodes-memu
```

Or use environment variable:

```yaml
# docker-compose.yml
environment:
  - N8N_CUSTOM_EXTENSIONS=/home/node/.n8n/nodes
volumes:
  - ./custom-nodes:/home/node/.n8n/nodes
```

## Nodes

This package provides six nodes for comprehensive MemU integration:

### MemU Memorize

Extract and store structured memory from multimodal inputs.

| Property | Type | Description |
|----------|------|-------------|
| Resource Source | Options | Choose between input data or manual URL |
| Resource URL | String | URL or path to the resource |
| Modality | Options | Type of content: conversation, document, image, video, audio |
| User Scoping | Collection | Optional user/agent context for scoped storage |

**Output**: Resource metadata, extracted memory items, and updated categories.

### MemU Retrieve

Query and retrieve relevant memories using RAG or LLM methods.

| Property | Type | Description |
|----------|------|-------------|
| Query Source | Options | Choose between input data or manual query |
| Query Text | String | Search query for memory retrieval |
| Retrieval Method | Options | RAG (fast) or LLM (deep semantic) |
| Context Messages | Collection | Previous conversation context |
| Filters | Collection | User/agent scope filters |

**Output**: Relevant categories, memory items, and resources with similarity scores.

### MemU List Items

List and browse stored memory items and categories.

| Property | Type | Description |
|----------|------|-------------|
| List Type | Options | Memory items or categories |
| User Scope Filters | Collection | Filter by user/agent ID |
| Limit | Number | Maximum items to return |

### MemU Create Item

Create new memory items manually.

| Property | Type | Description |
|----------|------|-------------|
| Memory Type | Options | behavior, event, knowledge, profile, skill |
| Content | String | Memory content/summary |
| Categories | Array | Category assignments |
| User Scoping | Collection | User/agent context |

### MemU Update Item

Update existing memory items by ID.

| Property | Type | Description |
|----------|------|-------------|
| Item ID Source | Options | From input or manual entry |
| Item ID | String | Memory item ID to update |
| Update Fields | Collection | Fields to update (type, content, categories) |

### MemU Delete Item

Delete memory items by ID.

| Property | Type | Description |
|----------|------|-------------|
| Item ID Source | Options | From input or manual entry |
| Item ID | String | Memory item ID to delete |
| Confirm Delete | Boolean | Safety confirmation |

## Credentials

### MemU Cloud API

For MemU Cloud service (https://memu.so):

| Field | Description |
|-------|-------------|
| API Key | Your MemU Cloud API key (from dashboard) |
| Base URL | API endpoint (default: https://api.memu.so) |

### MemU Self-hosted API

For self-hosted MemU instances:

| Field | Description |
|-------|-------------|
| Base URL | Your MemU instance URL (e.g., http://localhost:8000) |
| Authentication Method | API Key or None |
| API Key | Optional API key if authentication is enabled |

## Configuration Examples

### Example 1: Basic Document Memorization

```json
{
  "resourceSource": "manual",
  "resourceUrl": "https://example.com/document.pdf",
  "modality": "document",
  "userScoping": {
    "user_id": "user-123",
    "agent_id": "assistant-1"
  }
}
```

### Example 2: Conversation Memory with Context

```json
{
  "querySource": "manual",
  "queryText": "What are the user's preferences?",
  "method": "llm",
  "contextMessages": {
    "messages": [
      { "role": "user", "content": "I prefer dark mode" },
      { "role": "assistant", "content": "I'll remember that preference" }
    ]
  },
  "filters": {
    "user_id": "user-123"
  }
}
```

### Example 3: Batch Processing from Input

```json
{
  "resourceSource": "input",
  "resourceUrlField": "documentUrl",
  "modality": "document"
}
```

Input data:
```json
[
  { "documentUrl": "https://example.com/doc1.pdf" },
  { "documentUrl": "https://example.com/doc2.pdf" }
]
```

## Workflow Integration Patterns

### Pattern 1: Document Processing Pipeline

```
┌─────────────┐    ┌──────────────┐    ┌──────────────┐    ┌─────────────┐
│ HTTP Request│───▶│MemU Memorize│───▶│MemU Retrieve │───▶│ AI Response │
└─────────────┘    └──────────────┘    └──────────────┘    └─────────────┘
```

Use case: Fetch documents, extract memory, query for context, generate AI responses.

### Pattern 2: Chatbot with Memory

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────────┐
│ Webhook     │───▶│MemU Retrieve │───▶│ OpenAI Chat │───▶│MemU Memorize│
└─────────────┘    └──────────────┘    └─────────────┘    └──────────────┘
```

Use case: Receive user message, retrieve relevant memories, generate response, store conversation.

### Pattern 3: Knowledge Base Sync

```
┌─────────────┐    ┌──────────────┐    ┌──────────────┐
│ Schedule    │───▶│ HTTP Request │───▶│MemU Memorize│
│ Trigger     │    │ (fetch docs) │    │ (batch)     │
└─────────────┘    └──────────────┘    └──────────────┘
```

Use case: Periodically sync external knowledge sources into MemU memory.

### Pattern 4: Memory Cleanup Workflow

```
┌─────────────┐    ┌───────────────┐    ┌───────────────┐
│ Schedule    │───▶│MemU List Items│───▶│MemU Delete   │
│ Trigger     │    │ (filter old)  │    │ Item (batch) │
└─────────────┘    └───────────────┘    └───────────────┘
```

Use case: Automated cleanup of outdated memory items.

### Pattern 5: Multi-Modal Processing

```
                    ┌──────────────┐
                 ┌─▶│MemU Memorize│──┐
┌─────────────┐  │  │ (document)  │  │  ┌──────────────┐
│ Split Input │──┤  └──────────────┘  ├─▶│ Merge Results│
└─────────────┘  │  ┌──────────────┐  │  └──────────────┘
                 └─▶│MemU Memorize│──┘
                    │ (image)     │
                    └──────────────┘
```

Use case: Process different content types in parallel and merge results.

## Troubleshooting

### Connection Issues

**Problem**: "Connection refused" or "ECONNREFUSED" error

**Solutions**:
1. Verify the MemU service is running and accessible
2. Check the Base URL in credentials (include protocol: `http://` or `https://`)
3. For self-hosted: ensure firewall allows connections on the MemU port
4. For Docker: use host network or proper container networking

**Problem**: "Authentication failed" error

**Solutions**:
1. Verify API key is correct and not expired
2. Check API key has necessary permissions
3. For self-hosted: ensure authentication method matches server configuration

### Processing Issues

**Problem**: "Invalid modality" error

**Solution**: Ensure modality matches content type:
- `conversation` - JSON conversation logs
- `document` - PDF, TXT, DOCX files
- `image` - PNG, JPG, WEBP images
- `video` - MP4, MOV video files
- `audio` - MP3, WAV audio files

**Problem**: "Resource not accessible" error

**Solutions**:
1. Verify URL is publicly accessible or MemU has access
2. Check URL format (must be valid HTTP/HTTPS URL or local path)
3. For local files: ensure MemU service can access the file path

**Problem**: Slow retrieval performance

**Solutions**:
1. Use `rag` method for faster results (embedding-based)
2. Use `llm` method only when deep semantic understanding is needed
3. Add user scope filters to narrow search space
4. Consider indexing optimization on MemU server

### Data Issues

**Problem**: Empty retrieval results

**Solutions**:
1. Verify memories exist for the given user scope
2. Check query relevance to stored content
3. Try broader search terms or remove filters
4. Use MemU List Items to verify stored data

**Problem**: Duplicate memories

**Solution**: MemU handles deduplication automatically, but you can:
1. Use consistent user scoping
2. Check for duplicate memorize operations in workflow
3. Use Update Item instead of Create Item for existing content

## FAQ

### General Questions

**Q: What's the difference between RAG and LLM retrieval methods?**

A: RAG (Retrieval-Augmented Generation) uses fast embedding-based similarity search, ideal for quick lookups. LLM method uses language model reasoning for deeper semantic understanding, better for complex queries but slower.

**Q: Can I use both MemU Cloud and self-hosted in the same workflow?**

A: Yes, create separate credentials for each and select the appropriate one per node.

**Q: How is memory scoped between users?**

A: Use the User Scoping fields (user_id, agent_id) to isolate memories. Each unique combination creates a separate memory space.

### Technical Questions

**Q: What's the maximum document size for memorization?**

A: Depends on your MemU instance configuration. Cloud service has default limits; self-hosted can be configured. Large documents are automatically chunked.

**Q: How do I handle rate limiting?**

A: The nodes automatically retry with exponential backoff (up to 3 attempts). For high-volume workflows, add delays between operations or use batch processing.

**Q: Can I chain multiple MemU nodes together?**

A: Yes, all node outputs are compatible as inputs for other MemU nodes. Use the "From Input" option to pass data between nodes.

**Q: How do I debug MemU API calls?**

A: Enable n8n's execution data logging. Check the node output for detailed response data including any error messages from the MemU API.

### Integration Questions

**Q: Can I use MemU with OpenAI/Anthropic nodes?**

A: Yes! Common pattern: Retrieve → AI Chat → Memorize. Use retrieved memories as context for AI responses, then store the conversation.

**Q: How do I migrate from another memory solution?**

A: Use MemU Create Item node to bulk import existing memories. Format your data to match MemU's memory types (behavior, event, knowledge, profile, skill).

## Resources

- [n8n Community Nodes Documentation](https://docs.n8n.io/integrations/community-nodes/)
- [MemU Documentation](https://memu.so/docs)
- [MemU GitHub Repository](https://github.com/memu-ai/memu)
- [MemU API Reference](https://memu.so/docs/api)
- [Report Issues](https://github.com/memu-ai/n8n-nodes-memu/issues)

## License

[MIT](LICENSE) © MemU Team
