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
              description:
                'Optional account ID for account-specific contract search'
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
          'Create an escalation. This is a state-changing action. NEVER call this tool unless the user has explicitly confirmed that they want the escalation created.',
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

Use the available tools to answer support questions accurately.

Rules:
- Use query_account_data for account, order, or ticket facts.
- Use search_documents for policies, SOPs, contracts, SLAs, service credits, and product documentation.
- Customer-specific agreements override generic policies when applicable.
- Do not use deprecated documents when a current relevant document exists.
- Never invent information.
- You may use multiple tools when necessary.
- create_escalation is a state-changing action.
- NEVER call create_escalation unless the user has explicitly confirmed that they want the escalation created.
- If an escalation is appropriate but the user has not confirmed, explain what would be escalated and ask for confirmation.
- Once the user explicitly confirms, you may call create_escalation.
- Keep answers concise and clear.
`;

function isExplicitConfirmation(message) {
  const confirmation = message.toLowerCase().trim();

  return (
    confirmation === 'yes' ||
    confirmation === 'yes please' ||
    confirmation === 'confirm' ||
    confirmation === 'confirmed' ||
    confirmation === 'proceed' ||
    confirmation === 'go ahead' ||
    confirmation === 'do it' ||
    confirmation === 'create it' ||
    confirmation === 'create the escalation' ||
    confirmation === 'escalate it' ||
    confirmation.startsWith('yes,') ||
    confirmation.startsWith('yes please') ||
    confirmation.startsWith('confirm ') ||
    confirmation.startsWith('go ahead')
  );
}

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

    // Gemini has finished using tools and is returning its final answer
    if (functionCalls.length === 0) {
      return {
        type: 'message',
        toolsUsed,
        response: response.text || 'No response generated.'
      };
    }

    // Preserve Gemini's original response including thought_signature
    contents.push({
      role: 'model',
      parts: response.candidates[0].content.parts
    });

    for (const functionCall of functionCalls) {
      // State-changing action requires explicit confirmation
      if (functionCall.name === 'create_escalation') {
        if (!isExplicitConfirmation(message)) {
          return {
            type: 'confirmation_required',
            toolsUsed,
            response:
              'I can create this escalation, but this will create a new escalation record. Please confirm that you want me to proceed.'
          };
        }
      }

      const result = await executeTool(functionCall, context);

      toolsUsed.push({
        name: functionCall.name,
        args: functionCall.args
      });

      // IMPORTANT:
      // Once the escalation is created, stop the tool-calling loop
      // and return success immediately.
      if (functionCall.name === 'create_escalation') {
        return {
          type: 'message',
          toolsUsed,
          response: 'The escalation has been created successfully.',
          result
        };
      }

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
    'Yes, please proceed with the P1 escalation for Northstar Logistics order ORD-1001.'
  )
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error('Error:', error);
    });
}
