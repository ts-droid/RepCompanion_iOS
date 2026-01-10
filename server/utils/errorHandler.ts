import type { Response } from "express";
import { ZodError } from "zod";

export interface ApiError extends Error {
  status?: number;
  errors?: any;
}

export function handleError(error: any, res: Response, defaultMessage: string = "Internal server error") {
  const status = error?.status || error?.statusCode || 500;

  if (error instanceof ZodError) {
    return res.status(400).json({
      message: "Validation error",
      errors: error.errors,
    });
  }

  if (error instanceof Error) {
    return res.status(status).json({
      message: error.message || defaultMessage,
    });
  }

  return res.status(status).json({
    message: defaultMessage,
  });
}

export function createApiError(message: string, status: number = 500, errors?: any): ApiError {
  const error = new Error(message) as ApiError;
  error.status = status;
  error.errors = errors;
  return error;
}
