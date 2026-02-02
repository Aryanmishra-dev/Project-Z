/**
 * Swagger/OpenAPI Configuration
 * API documentation setup
 */
import swaggerJSDoc from 'swagger-jsdoc';

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Quiz App API',
    version: '1.0.0',
    description: 'API for PDF Quiz Generator - Upload PDFs, generate questions, and take quizzes',
    contact: {
      name: 'API Support',
    },
    license: {
      name: 'MIT',
    },
  },
  servers: [
    {
      url: '/api/v1',
      description: 'API v1',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter your JWT access token',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
              details: { type: 'object' },
            },
          },
        },
      },
      Pdf: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          userId: { type: 'string', format: 'uuid' },
          filename: { type: 'string' },
          fileSizeBytes: { type: 'integer' },
          pageCount: { type: 'integer', nullable: true },
          status: {
            type: 'string',
            enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
          },
          metadata: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              author: { type: 'string' },
              subject: { type: 'string' },
              keywords: { type: 'array', items: { type: 'string' } },
            },
          },
          errorMessage: { type: 'string', nullable: true },
          processingStartedAt: { type: 'string', format: 'date-time', nullable: true },
          processingCompletedAt: { type: 'string', format: 'date-time', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      Question: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          pdfId: { type: 'string', format: 'uuid' },
          questionText: { type: 'string' },
          options: {
            type: 'object',
            properties: {
              A: { type: 'string' },
              B: { type: 'string' },
              C: { type: 'string' },
              D: { type: 'string' },
            },
          },
          correctOption: { type: 'string', enum: ['A', 'B', 'C', 'D'] },
          explanation: { type: 'string', nullable: true },
          difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
          pageReference: { type: 'integer', nullable: true },
          qualityScore: { type: 'number', minimum: 0, maximum: 1 },
          validationStatus: {
            type: 'string',
            enum: ['pending', 'valid', 'invalid', 'needs_review'],
          },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      QuizSession: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          userId: { type: 'string', format: 'uuid' },
          pdfId: { type: 'string', format: 'uuid' },
          difficultyFilter: { type: 'string', enum: ['easy', 'medium', 'hard'], nullable: true },
          totalQuestions: { type: 'integer' },
          correctAnswers: { type: 'integer' },
          status: {
            type: 'string',
            enum: ['in_progress', 'completed', 'abandoned', 'timed_out'],
          },
          scorePercentage: { type: 'number', nullable: true },
          startedAt: { type: 'string', format: 'date-time' },
          completedAt: { type: 'string', format: 'date-time', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      UserAnswer: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          quizSessionId: { type: 'string', format: 'uuid' },
          questionId: { type: 'string', format: 'uuid' },
          selectedOption: { type: 'string', enum: ['A', 'B', 'C', 'D'] },
          isCorrect: { type: 'boolean' },
          timeSpentSeconds: { type: 'integer', nullable: true },
          confidenceLevel: {
            type: 'string',
            enum: ['very_low', 'low', 'medium', 'high', 'very_high'],
            nullable: true,
          },
          answeredAt: { type: 'string', format: 'date-time' },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email' },
          name: { type: 'string' },
          role: { type: 'string', enum: ['user', 'admin'] },
          isActive: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      AuthTokens: {
        type: 'object',
        properties: {
          accessToken: { type: 'string' },
          refreshToken: { type: 'string' },
          expiresIn: { type: 'integer', description: 'Access token expiry in seconds' },
        },
      },
    },
  },
  tags: [
    {
      name: 'System',
      description: 'Health checks and system status',
    },
    {
      name: 'Authentication',
      description: 'User authentication and session management',
    },
    {
      name: 'PDFs',
      description: 'PDF upload, processing, and management',
    },
    {
      name: 'Questions',
      description: 'Quiz questions management',
    },
    {
      name: 'Quiz Sessions',
      description: 'Quiz session creation and submission',
    },
    {
      name: 'Analytics',
      description: 'User statistics and dashboard data',
    },
  ],
};

const options = {
  swaggerDefinition,
  apis: ['./src/routes/*.ts', './src/routes/**/*.ts'],
};

export const swaggerSpec = swaggerJSDoc(options);
