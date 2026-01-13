# n8n-nodes-memu

This is an n8n community node package that integrates MemU's agentic memory capabilities into n8n workflows.

[MemU](https://memu.so) is an agentic memory framework for LLM and AI agent backends that processes multimodal inputs into structured memory.

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

### Community Nodes (Recommended)

1. Go to **Settings > Community Nodes**.
2. Select **Install**.
3. Enter `n8n-nodes-memu` in **Enter npm package name**.
4. Agree to the [risks](https://docs.n8n.io/integrations/community-nodes/risks/) of using community nodes: select **I understand the risks of installing unverified code from a public source**.
5. Select **Install**.

After installing the node, you can use it like any other node. n8n loads it automatically.

### Manual Installation

To get started install the package in your n8n root directory:

```bash
npm install n8n-nodes-memu
```

For Docker-based deployments add the following line before the font installation command in your [n8n Dockerfile](https://github.com/n8n-io/n8n/blob/master/docker/images/n8n/Dockerfile):

```dockerfile
RUN cd /usr/local/lib/node_modules/n8n && npm install n8n-nodes-memu
```

## Nodes

This package provides six nodes for comprehensive MemU integration:

### Core Nodes

- **MemU Memorize**: Extract and store structured memory from multimodal inputs
- **MemU Retrieve**: Query and retrieve relevant memories using RAG or LLM methods

### CRUD Nodes

- **MemU List Items**: List and browse stored memory items and categories
- **MemU Create Item**: Create new memory items manually
- **MemU Update Item**: Update existing memory items
- **MemU Delete Item**: Delete memory items

## Credentials

The package supports both MemU Cloud and self-hosted instances:

- **MemU Cloud API**: For MemU Cloud service with API key authentication
- **MemU Self-hosted API**: For self-hosted MemU instances with configurable authentication

## Usage

### Basic Workflow

1. **Set up credentials**: Configure either MemU Cloud API or MemU Self-hosted API credentials
2. **Memorize content**: Use the MemU Memorize node to process and store multimodal content
3. **Retrieve memories**: Use the MemU Retrieve node to query stored knowledge
4. **Manage memories**: Use CRUD nodes to list, create, update, or delete memory items

### Example: Document Processing Pipeline

```
HTTP Request → MemU Memorize → MemU Retrieve → Process Results
```

1. Fetch document from URL
2. Memorize document content and extract structured memory
3. Query related memories for context
4. Process and use the retrieved information

## Configuration

### MemU Cloud

1. Sign up at [MemU Cloud](https://memu.so)
2. Get your API key from the dashboard
3. Configure the MemU Cloud API credential with your API key

### Self-hosted MemU

1. Deploy MemU using the [self-hosting guide](https://memu.so/docs/self-hosting)
2. Configure the MemU Self-hosted API credential with your instance URL
3. Set up authentication (API key or none) based on your deployment

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/community-nodes/)
- [MemU Documentation](https://memu.so/docs)
- [MemU GitHub Repository](https://github.com/memu-ai/memu)

## License

[MIT](https://github.com/memu-ai/n8n-nodes-memu/blob/main/LICENSE.md)