import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../context/ToastContext';
import { throwIfApiFailed } from '../services/api';

/**
 * طبقة رفيعة فوق useMutation:
 * - يحوّل استجابة { success: false } إلى خطأ (قابل للتعطيل).
 * - يبطل مفاتيح استعلام بعد النجاح.
 * - يعرض Toast للنجاح/الخطأ عند التفعيل.
 *
 * هذا hook يبقى حد توافق محميًا إلى أن تُشدّد كل endpoints القديمة لتعيد عقودًا مصنفة.
 */
export function useApiMutation(options: any) {
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

  const wrappedMutationFn = async (variables: unknown) => {
    const result = await rawMutationFn(variables);
    if (rejectOnApiFailure) {
      throwIfApiFailed(result);
    }
    return result;
  };

  return useMutation<any, Error, any, unknown>({
    mutationFn: wrappedMutationFn,
    ...rest,
    onSuccess: async (data, variables, context) => {
      if (typeof userOnSuccess === 'function') {
        await userOnSuccess(data, variables, context);
      }
      for (const spec of invalidateQueries) {
        if (Array.isArray(spec)) {
          queryClient.invalidateQueries({ queryKey: spec });
        } else if (spec && typeof spec === 'object') {
          queryClient.invalidateQueries(spec);
        }
      }
      if (successToast !== undefined && successToast !== null && successToast !== false) {
        const msg = typeof successToast === 'function' ? successToast(data, variables) : successToast;
        if (msg) showToast(msg, 'success');
      }
    },
    onError: async (error, variables, context) => {
      if (typeof userOnError === 'function') {
        await userOnError(error, variables, context);
      }
      if (showErrorToast) {
        const msg = typeof errorToast === 'function'
          ? errorToast(error, variables)
          : (errorToast || error?.message || '');
        if (msg) showToast(msg, 'error');
      }
    },
  });
}
