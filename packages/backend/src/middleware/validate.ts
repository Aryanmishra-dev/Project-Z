/**
 * Validation middleware using Zod schemas
 * Validates request body, params, and query against Zod schemas
 */
import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';

/**
 * Validation target options
 */
export type ValidationTarget = 'body' | 'params' | 'query';

/**
 * Validation options
 */
export interface ValidationOptions {
  /** Strip unknown keys from validated object */
  stripUnknown?: boolean;
}

/**
 * Create validation middleware for a specific request part
 * @param schema Zod schema to validate against
 * @param target Part of request to validate (body, params, query)
 * @param options Validation options
 */
export function validate<T>(
  schema: ZodSchema<T>,
  target: ValidationTarget = 'body',
  options: ValidationOptions = {}
) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const data = req[target];
      
      // Parse and validate
      const result = schema.safeParse(data);
      
      if (!result.success) {
        const fieldErrors = formatZodErrors(result.error);
        
        logger.debug('Validation failed', {
          target,
          errors: fieldErrors,
          path: req.path,
        });
        
        throw new ValidationError('Validation failed', fieldErrors);
      }
      
      // Replace request data with parsed/transformed data
      if (options.stripUnknown !== false) {
        (req as unknown as Record<string, unknown>)[target] = result.data;
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Format Zod errors into field-specific error messages
 * @param error Zod error object
 * @returns Object mapping field names to error message arrays
 */
function formatZodErrors(error: ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  
  for (const issue of error.errors) {
    const path = issue.path.join('.') || '_root';
    
    if (!fieldErrors[path]) {
      fieldErrors[path] = [];
    }
    
    fieldErrors[path].push(issue.message);
  }
  
  return fieldErrors;
}

/**
 * Validate multiple parts of the request at once
 * @param schemas Object mapping targets to their schemas
 * @param options Validation options
 */
export function validateMultiple(
  schemas: Partial<Record<ValidationTarget, ZodSchema>>,
  options: ValidationOptions = {}
) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const allErrors: Record<string, string[]> = {};
    
    for (const [target, schema] of Object.entries(schemas) as Array<[ValidationTarget, ZodSchema]>) {
      if (!schema) continue;
      
      const data = req[target];
      const result = schema.safeParse(data);
      
      if (!result.success) {
        const errors = formatZodErrors(result.error);
        for (const [field, messages] of Object.entries(errors)) {
          const key = `${target}.${field}`;
          allErrors[key] = messages;
        }
      } else if (options.stripUnknown !== false) {
        (req as unknown as Record<string, unknown>)[target] = result.data;
      }
    }
    
    if (Object.keys(allErrors).length > 0) {
      next(new ValidationError('Validation failed', allErrors));
      return;
    }
    
    next();
  };
}
