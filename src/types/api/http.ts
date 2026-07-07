/** Unified frontend HTTP result envelope. Unspecified payloads are unknown by default. */
export type ApiParsedResult<TData = unknown, TItems = unknown> = {
  success: boolean;
  data?: TData;
  items?: TItems;
  total?: number;
  page?: number;
  pageSize?: number;
  error?: string;
  code?: number;
  isTransientServerError?: boolean;
  isNetworkError?: boolean;
};
