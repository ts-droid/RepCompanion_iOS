import type { Request, Response } from "express";

export interface AuthenticatedRequest extends Request {
  user?: {
    claims: {
      sub: string;
      [key: string]: any;
    };
  };
}

export interface AuthenticatedResponse extends Response {
  user?: {
    claims: {
      sub: string;
      [key: string]: any;
    };
  };
}

export interface ApiResponse<T = any> {
  data?: T;
  message?: string;
  errors?: any;
}

export interface ErrorResponse {
  message: string;
  errors?: any;
  status: number;
}
