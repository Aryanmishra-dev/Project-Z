/**
 * Swagger/OpenAPI documentation setup
 * Configures swagger-jsdoc and swagger-ui-express
 */
import { Express } from 'express';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

/**
 * OpenAPI specification options
 */
const swaggerOptions: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'PDF Quiz Generator API',
      version: '1.0.0',
      description: `
# PDF Quiz Generator API

This API powers the PDF Quiz Generator application, enabling users to:
- Upload PDF documents
- Generate AI-powered quiz questions from PDF content
- Take quizzes and track progress
- Manage user accounts and sessions

## Authentication

Most endpoints require authentication via JWT Bearer tokens. 
Include the token in the Authorization header:

\`\`\`
Authorization: Bearer <access_token>
\`\`\`

Access tokens expire after 15 minutes. Use the refresh token endpoint to get new tokens.

## Rate Limiting

API endpoints are rate limited to prevent abuse:
- Authentication endpoints: 5 requests per 15 minutes per IP
- General API: 1000 requests per 15 minutes per IP
- Login attempts: 5 attempts per 15 minutes per IP+email combination

## Error Handling

All errors follow a consistent format:

\`\`\`json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "requestId": "uuid-for-tracking",
    "details": {}
  }
}
\`\`\`
      `,
      contact: {
        name: 'API Support',
        email: 'support@pdfquizgen.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
      {
        url: 'https://api.pdfquizgen.com',
        description: 'Production server',
      },
    ],
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and session management',
      },
      {
        name: 'Users',
        description: 'User profile management',
      },
      {
        name: 'PDFs',
        description: 'PDF document upload and management',
      },
      {
        name: 'Questions',
        description: 'Quiz question generation and management',
      },
      {
        name: 'Quizzes',
        description: 'Quiz sessions and results',
      },
      {
        name: 'System',
        description: 'System health and status endpoints',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT access token obtained from login or register endpoints',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Unique user identifier',
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address',
            },
            fullName: {
              type: 'string',
              description: 'User full name',
            },
            role: {
              type: 'string',
              enum: ['user', 'admin'],
              description: 'User role',
            },
            emailVerified: {
              type: 'boolean',
              description: 'Email verification status',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Account creation timestamp',
            },
          },
        },
        TokenPair: {
          type: 'object',
          properties: {
            accessToken: {
              type: 'string',
              description: 'JWT access token (15 min expiry)',
            },
            refreshToken: {
              type: 'string',
              description: 'JWT refresh token (7 day expiry)',
            },
            expiresIn: {
              type: 'integer',
              description: 'Access token expiry in seconds',
            },
          },
        },
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            error: {
              type: 'object',
              properties: {
                code: {
                  type: 'string',
                  description: 'Error code for programmatic handling',
                },
                message: {
                  type: 'string',
                  description: 'Human-readable error message',
                },
                requestId: {
                  type: 'string',
                  format: 'uuid',
                  description: 'Request ID for tracking/debugging',
                },
                details: {
                  type: 'object',
                  description: 'Additional error details',
                },
              },
            },
          },
        },
        ValidationError: {
          allOf: [
            { $ref: '#/components/schemas/Error' },
            {
              type: 'object',
              properties: {
                error: {
                  type: 'object',
                  properties: {
                    details: {
                      type: 'object',
                      properties: {
                        fieldErrors: {
                          type: 'object',
                          additionalProperties: {
                            type: 'array',
                            items: { type: 'string' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          ],
        },
        RegisterRequest: {
          type: 'object',
          required: ['email', 'password', 'fullName'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              example: 'user@example.com',
            },
            password: {
              type: 'string',
              minLength: 8,
              example: 'StrongP@ss123',
              description: 'Must contain uppercase, lowercase, digit, and special character',
            },
            fullName: {
              type: 'string',
              minLength: 2,
              example: 'John Doe',
            },
          },
        },
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              example: 'user@example.com',
            },
            password: {
              type: 'string',
              example: 'StrongP@ss123',
            },
          },
        },
        RefreshRequest: {
          type: 'object',
          required: ['refreshToken'],
          properties: {
            refreshToken: {
              type: 'string',
              description: 'Valid refresh token',
            },
          },
        },
        AuthResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            data: {
              type: 'object',
              properties: {
                user: { $ref: '#/components/schemas/User' },
                tokens: { $ref: '#/components/schemas/TokenPair' },
              },
            },
            message: {
              type: 'string',
            },
          },
        },
      },
      responses: {
        UnauthorizedError: {
          description: 'Authentication required or token invalid',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
              example: {
                success: false,
                error: {
                  code: 'AUTHENTICATION_ERROR',
                  message: 'Invalid or expired token',
                  requestId: '550e8400-e29b-41d4-a716-446655440000',
                },
              },
            },
          },
        },
        ForbiddenError: {
          description: 'Insufficient permissions',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
              example: {
                success: false,
                error: {
                  code: 'AUTHORIZATION_ERROR',
                  message: 'Insufficient permissions',
                  requestId: '550e8400-e29b-41d4-a716-446655440000',
                },
              },
            },
          },
        },
        ValidationErrorResponse: {
          description: 'Request validation failed',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ValidationError' },
              example: {
                success: false,
                error: {
                  code: 'VALIDATION_ERROR',
                  message: 'Validation failed',
                  requestId: '550e8400-e29b-41d4-a716-446655440000',
                  details: {
                    fieldErrors: {
                      email: ['Invalid email format'],
                      password: ['Password must be at least 8 characters'],
                    },
                  },
                },
              },
            },
          },
        },
        RateLimitError: {
          description: 'Too many requests',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
              example: {
                success: false,
                error: {
                  code: 'RATE_LIMIT_EXCEEDED',
                  message: 'Too many requests, retry after 900 seconds',
                  retryAfter: 900,
                },
              },
            },
          },
        },
      },
    },
  },
  apis: ['./src/routes/*.ts', './src/controllers/*.ts'],
};

/**
 * Generate OpenAPI specification
 */
export const swaggerSpec = swaggerJsdoc(swaggerOptions);

/**
 * Setup Swagger UI and JSON endpoint
 */
export function swaggerSetup(app: Express): void {
  // Swagger UI
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customSiteTitle: 'PDF Quiz Generator API',
      customCss: '.swagger-ui .topbar { display: none }',
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
      },
    })
  );

  // Raw OpenAPI JSON
  app.get('/api-docs.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
}
