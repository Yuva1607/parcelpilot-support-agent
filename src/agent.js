require('dotenv').config();

const { GoogleGenAI } = require('@google/genai');
const { searchDocumentTool } = require('./tools_documents');
const { queryAccountData } = require('./tools_data');
const { createEscalation } = require('./tools_escalation');

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

const MODEL = 'gemini-3.6-flash';

const tools = [
  {
    functionDeclarations: [
      {
        name: 'search_documents',
        description:
          'Search ParcelPilot policies, SOPs, product guides, and customer agreements. Use for cancellation rules, SLAs, service credits, support policies, contracts, and product documentation.',
        parameters: {
          type: 'OBJECT',
          properties: {
            query: {
              type: 'STRING',
              description: 'The information to search for'
            },
            accountId: {
              type: 'STRING',
              description: 'Optional account ID for account-specific contract search'
            }
          },
          required: ['query']
        }
      },
      {
        name: 'query_account_data',
        description:
          'Look up structured account, order, ticket, and dataset information.',
        parameters: {
          type: 'OBJECT',
          properties: {
            queryType: {
              type: 'STRING',
              enum: [
                'get_account',
                'get_order',
                'list_orders_for_account',
                'get_ticket',
                'list_tickets_for_account',
                'list_open_tickets',
                'get_snapshot_time'
              ]
            },
            accountId: {
              type: 'STRING'
            },
            orderId: {
              type: 'STRING'
            },
            ticketId: {
              type: 'STRING'
            }
          },
          required: ['queryType']
        }
      },
      {
        name: 'create_escalation',
        description:
          'Create an escalation. This changes system state and must only be called after the user explicitly confirms they want the escalation created.',
        parameters: {
          type: 'OBJECT',
          properties: {
            accountId: {
              type: 'STRING'
            },
            orderId: {
              type: 'STRING'
            },
            ticketId: {
              type: 'STRING'
            },
            reason: {
              type: 'STRING'
            },
            priority: {
              type: 'STRING',
              enum: ['P1', 'P2', 'P3']
            }
          },
          required: ['accountId', 'reason']
        }
      }
    ]
  }
];

const systemInstruction = `
You are ParcelPilot's internal support assistant.

Use tools to answer questions accurately.

Rules:
- Use query_account_data for account, order, or ticket facts.
- Use search_documents for policies, SOPs, contracts, SLAs, service credits, and product documentation.
- Customer-specific agreements override generic policies when applicable.
- Do not use deprecated documents unless no relevant current document exists.
- Never invent information.
- If a question requires both structured data and policy information, call multiple tools as needed.
- Before calling create_escalation, ask the user for explicit confirmation unless they have already explicitly confirmed.
- After all required tool calls are complete, give a clear, concise answer.
`;

async function executeTool(functionCall, context) {
  const args = functionCall.args || {};

  switch (functionCall.name) {
    case 'search_documents':
      return await searchDocumentTool(args);

    case 'query_account_data':
      return queryAccountData(args, {
        role: context.role
      });

    case 'create_escalation':
      return createEscalation(args, {
        role: context.role
      });

    default:
      throw new Error(`Unknown tool: ${functionCall.name}`);
  }
}

async function runAgent(message, context = { role: 'agent' }) {
  const contents = [
    {
      role: 'user',
      parts: [{ text: message }]
    }
  ];

  const toolsUsed = [];
  const maxSteps = 6;

  for (let step = 0; step < maxSteps; step++) {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents,
      config: {
        systemInstruction,
        tools
      }
    });

    const functionCalls = response.functionCalls || [];

    // No more tools requested: Gemini has produced the final answer
    if (functionCalls.length === 0) {
      return {
        type: 'message',
        toolsUsed,
        response: response.text || 'No response generated.'
      };
    }

    // Preserve the exact Gemini response, including thought signatures
    contents.push({
      role: 'model',
      parts: response.candidates[0].content.parts
    });

    // Execute every requested tool
    for (const functionCall of functionCalls) {
      const result = await executeTool(functionCall, context);

      toolsUsed.push({
        name: functionCall.name,
        args: functionCall.args
      });

      contents.push({
        role: 'user',
        parts: [
          {
            functionResponse: {
              name: functionCall.name,
              response: {
                result
              }
            }
          }
        ]
      });
    }
  }

  throw new Error(
    `Agent exceeded the maximum of ${maxSteps} tool-calling steps`
  );
}

module.exports = { runAgent };

if (require.main === module) {
  runAgent(
    'Can Northstar Logistics cancel order ORD-1001 without paying a cancellation fee?'
  )
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error('Error:', error);
    });
}
