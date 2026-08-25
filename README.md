# ParcelPilot Support Agent

An AI-powered customer support agent built for the ParcelPilot assessment.

## Features

- Natural-language customer support chat
- Account, order, and ticket data lookup
- Search across support policies and customer agreements
- Customer-specific contract handling
- Document authority and priority handling
- Escalation creation with confirmation
- Role-based authorization for escalation actions
- Web-based chat interface
- Vercel deployment

## Architecture

Customer
↓
Web Chat UI
↓
Express Server
↓
Gemini AI Agent
↓
├── Account / Order / Ticket Data
├── PDF Document Search
└── Escalation Tool

## Agent Tools

### query_account_data

Retrieves account, order, and support ticket information from the ParcelPilot assessment data.

### search_documents

Searches the internal ParcelPilot support documents and customer agreements.

Documents are ranked based on:

1. Document authority
2. Current or deprecated status
3. Account-specific contract relevance
4. Keyword relevance

Active customer agreements take precedence over general policies when applicable.

### create_escalation

Creates a support escalation containing the relevant account, order, ticket, reason, priority, and status.

The agent requires explicit user confirmation before creating an escalation.

## Document Authority

The document search system follows this hierarchy:

1. Active customer enterprise agreement
2. Current support policy and SOP
3. Current product operations documentation
4. Deprecated documentation

Deprecated documents are not treated as authoritative.

## Example

For Northstar Logistics order `ORD-1001`, the agent can retrieve the order, identify the account, search the relevant documents, and determine the applicable cancellation policy.

The active Northstar Logistics agreement takes precedence over the standard cancellation policy when applicable.

## Escalation Safety

Escalations require explicit confirmation before execution.

Example:

User:
"Please escalate the cancellation issue for ORD-1001 as P1."

Agent:
"I can create this escalation, but this will create a new escalation record. Please confirm that you want me to proceed."

User:
"Yes, please proceed with the P1 escalation."

The escalation is then created.

## Technology Stack

- Node.js
- Express
- Google Gemini API
- `@google/genai`
- SQLite
- `better-sqlite3`
- XLSX
- PDF parsing
- HTML/CSS/JavaScript
- Vercel
- GitHub

## Project Structure

```text
parcelpilot-support-agent/
├── data/
├── public/
├── src/
│   ├── agent.js
│   ├── db.js
│   ├── documents.js
│   ├── tools_data.js
│   ├── tools_documents.js
│   ├── tools_escalation.js
│   └── server.js
├── package.json
└── README.md