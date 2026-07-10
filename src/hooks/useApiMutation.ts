import {
  useMutation,
  useQueryClient,
  type InvalidateQueryFilters,
  type QueryKey,
  type UseMutationOptions,
} from '@tanstack/react-query';
import { useToast } from '../context/ToastContext';
import { throwIfApiFailed } from '../services/api';

type InvalidateSpec = QueryKey | InvalidateQueryFilters;
type ToastMessage = string | false | null | undefined;

function isQueryKeyInvalidateSpec(spec: InvalidateSpec): spec is QueryKey {
  return Array.isArray(spec);
}

export type ApiMutationOptions<TData, TVariables = void, TContext = unknown> =
  Omit<UseMutationOptions<TData, Error, TVariables, TContext>, 'mutationFn' | 'onSuccess' | 'onError'> & {
    mutationFn: (variables: TVariables) => Promise<TData>;
    invalidateQueries?: InvalidateSpec[];
    successToast?: ToastMessage | ((data: TData, variables: TVariables) => ToastMessage);
    showErrorToast?: boolean;
    errorToast?: ToastMessage | ((error: Error, variables: TVariables) => ToastMessage);
    rejectOnApiFailure?: boolean;
    onSuccess?: UseMutationOptions<TData, Error, TVariables, TContext>['onSuccess'];
    onError?: UseMutationOptions<TData, Error, TVariables, TContext>['onError'];
  };

export function useApiMutation<TData = unknown, TVariables = void, TContext = unknown>(
  options: ApiMutationOptions<TData, TVariables, TContext>,
) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const {
    mutationFn: rawMutationFn,
    invalidateQueries = [],
    successToast,
    showErrorToast = true,
    errorToast,
    rejectOnApiFailure = true,
    onSuccess: userOnSuccess,
    onError: userOnError,
    ...rest
  } = options;

  const wrappedMutationFn = async (variables: TVariables): Promise<TData> => {
    const result = await rawMutationFn(variables);
    if (rejectOnApiFailure) {
      throwIfApiFailed(result);
    }
    return result;
  };

  return useMutation<TData, Error, TVariables, TContext>({
    mutationFn: wrappedMutationFn,
    ...rest,
    onSuccess: async (data, variables, onMutateResult, context) => {
      if (typeof userOnSuccess === 'function') {
        await userOnSuccess(data, variables, onMutateResult, context);
      }
      for (const spec of invalidateQueries) {
        if (isQueryKeyInvalidateSpec(spec)) {
          queryClient.invalidateQueries({ queryKey: spec });
        } else {
          queryClient.invalidateQueries(spec);
        }
      }
      if (successToast !== undefined && successToast !== null && successToast !== false) {
        const msg = typeof successToast === 'function' ? successToast(data, variables) : successToast;
        if (msg) showToast(msg, 'success');
      }
    },
    onError: async (error, variables, onMutateResult, context) => {
      if (typeof userOnError === 'function') {
        await userOnError(error, variables, onMutateResult, context);
      }
      if (showErrorToast) {
        const msg = typeof errorToast === 'function'
          ? errorToast(error, variables)
          : (errorToast || error.message || '');
        if (msg) showToast(msg, 'error');
      }
    },
  });
}
