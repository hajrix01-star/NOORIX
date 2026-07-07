import { useQueries, useQuery, type UseQueryOptions, type QueryKey } from '@tanstack/react-query';
import type { ApiParsedResult } from '../services/api';
import { unwrapApiData, unwrapApiDataOr, unwrapApiList } from '../services/api';

type ApiQueryOptions<TQueryFnData, TData = TQueryFnData> =
  Omit<UseQueryOptions<TQueryFnData, Error, TData, QueryKey>, 'queryKey' | 'queryFn'> & {
    queryKey: QueryKey;
    queryFn: () => Promise<ApiParsedResult<TQueryFnData>>;
    fallbackMessage?: string;
  };

export function useApiQuery<TQueryFnData, TData = TQueryFnData>({
  queryFn,
  fallbackMessage = 'طلب فشل',
  ...options
}: ApiQueryOptions<TQueryFnData, TData>) {
  return useQuery<TQueryFnData, Error, TData, QueryKey>({
    ...options,
    queryFn: async () => unwrapApiData(await queryFn(), fallbackMessage),
  });
}

type ApiQueryOrOptions<TQueryFnData, TData = TQueryFnData> =
  Omit<ApiQueryOptions<TQueryFnData, TData>, 'queryFn'> & {
    queryFn: () => Promise<ApiParsedResult<TQueryFnData | undefined>>;
    fallback: TQueryFnData;
  };

export function useApiQueryOr<TQueryFnData, TData = TQueryFnData>({
  queryFn,
  fallback,
  fallbackMessage = 'طلب فشل',
  ...options
}: ApiQueryOrOptions<TQueryFnData, TData>) {
  return useQuery<TQueryFnData, Error, TData, QueryKey>({
    ...options,
    queryFn: async () => unwrapApiDataOr<TQueryFnData>(
      (await queryFn()) as ApiParsedResult<TQueryFnData>,
      fallback,
      fallbackMessage,
    ),
  });
}

type ApiListQueryOptions<TItem, TData = TItem[]> =
  Omit<UseQueryOptions<TItem[], Error, TData, QueryKey>, 'queryKey' | 'queryFn'> & {
    queryKey: QueryKey;
    queryFn: () => Promise<ApiParsedResult<unknown>>;
    fallbackMessage?: string;
  };

export function useApiListQuery<TItem, TData = TItem[]>({
  queryFn,
  fallbackMessage = 'طلب فشل',
  ...options
}: ApiListQueryOptions<TItem, TData>) {
  return useQuery<TItem[], Error, TData, QueryKey>({
    ...options,
    queryFn: async () => unwrapApiList<TItem>((await queryFn()) as ApiParsedResult<any>, fallbackMessage),
  });
}

type ApiQueriesOptions = {
  queries: Array<
    Omit<UseQueryOptions<unknown, Error, unknown, QueryKey>, 'queryFn'> & {
      queryFn: () => Promise<ApiParsedResult<unknown>>;
      fallbackMessage?: string;
    }
  >;
};

export function useApiQueries({ queries }: ApiQueriesOptions) {
  return useQueries({
    queries: queries.map(({ queryFn, fallbackMessage = 'طلب فشل', ...options }) => ({
      ...options,
      queryFn: async () => unwrapApiData(await queryFn(), fallbackMessage),
    })),
  });
}
