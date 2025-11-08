export interface IApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  errors?: Array<{
    field: string;
    message: string;
  }>;
  meta?: {
    timestamp: Date;
    requestId: string;
    version: string;
  };
}

export interface IPaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface IPaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}

export interface ISearchParams extends IPaginationParams {
  query?: string;
  filters?: Record<string, any>;
}

export interface IFileUpload {
  fieldName: string;
  originalName: string;
  encoding: string;
  mimetype: string;
  size: number;
  url: string;
  path: string;
  uploadedAt: Date;
}

export interface IGeolocation {
  latitude: number;
  longitude: number;
  address?: string;
  city?: string;
  country?: string;
}

export interface IDateRange {
  startDate: Date;
  endDate: Date;
}

export interface IStatistics {
  totalUsers: number;
  activeUsers: number;
  totalSellers: number;
  totalProducts: number;
  activeProducts: number;
  totalOrders: number;
  completedOrders: number;
  totalRevenue: number;
  totalTransactions: number;
  averageOrderValue: number;
}

export interface IAuditLog {
  id: string;
  userId: string;
  userEmail: string;
  action: string;
  resourceType: string;
  resourceId: string;
  changes?: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
}

export enum Language {
  EN = 'en',
  VI = 'vi',
}

export interface ITranslation {
  [key: string]: {
    [Language.EN]: string;
    [Language.VI]: string;
  };
}

