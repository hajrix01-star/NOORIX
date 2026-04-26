import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../context/ToastContext';
import { rejectIfApiFailed } from '../utils/apiResponse';

/**
 * طبقة رفيعة فوق useMutation:
 * - يحوّل استجابة { success: false } إلى خطأ (قابل للتعطيل).
 * - يبطل مفاتيح استعلام بعد النجاح.
 * - يعرض Toast للنجاح/الخطأ عند التفعيل.
 *
 * @param {object} options — نفس خيارات useMutation مع الإضافات:
 * @param {import('@tanstack/react-query').UseMutationOptions['mutationFn']} options.mutationFn
 * @param {Array<Array|import('@tanstack/react-query').InvalidateQueryFilters>} [options.invalidateQueries]
 * @param {string|function(data, variables): string|null|undefined|false} [options.successToast] — نص أو دالة؛ null/false/undefined من الدالة = لا إشعار
 * @param {boolean} [options.showErrorToast=true]
 * @param {string|function(error, variables): string} [options.errorToast]
 * @param {boolean} [options.rejectOnApiFailure=true] — عند false لا يُرمى خطأ عند success === false
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
      rejectIfApiFailed(result);
    }
    return result;
  };

  return useMutation<any, Error, any, unknown>({
    mutationFn: wrappedMutationFn,
    ...rest,
    onSuccess: async (data: any, variables: any, context: any) => {
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
    onError: async (error: any, variables: any, context: any) => {
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
