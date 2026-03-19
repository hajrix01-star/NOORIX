/**
 * TenantContext — AsyncLocalStorage لتخزين tenant_id و user_id
 * عبر دورة حياة الطلب كاملة دون تمرير يدوي بين الطبقات.
 *
 * الاستخدام:
 *   1. TenantMiddleware: يُعيّن tenantId + userId في بداية كل request.
 *   2. TenantPrismaService: يقرأ tenantId ويحقنه عبر set_config() قبل كل query.
 *   3. أي Service: يستدعي TenantContext.getTenantId() أو .getUserId() مباشرة.
 */
import { AsyncLocalStorage } from 'async_hooks';

interface TenantStore {
  tenantId: string;
  userId:   string | null;
}

const storage = new AsyncLocalStorage<TenantStore>();

export const TenantContext = {
  /**
   * يُشغَّل في بداية كل HTTP request (في TenantMiddleware).
   * ينشئ Context معزولاً لهذا الطلب بالكامل.
   */
  run(tenantId: string, userId: string | null, fn: () => void): void {
    storage.run({ tenantId, userId }, fn);
  },

  /**
   * يُعيد tenantId الخاص بالطلب الحالي.
   * @throws إذا استُدعي خارج سياق HTTP request.
   */
  getTenantId(): string {
    const store = storage.getStore();
    if (!store?.tenantId) {
      throw new Error('TenantContext: لا يوجد tenant context — يجب استدعاء run() أولاً');
    }
    return store.tenantId;
  },

  /**
   * يُعيد userId المستخدم الحالي (null للعمليات الداخلية).
   */
  getUserId(): string | null {
    return storage.getStore()?.userId ?? null;
  },

  /**
   * يتحقق من وجود context صالح (للحراس Guards).
   */
  hasContext(): boolean {
    const store = storage.getStore();
    return !!store?.tenantId;
  },

  /**
   * يُعيد tenantId بشكل آمن — null إذا لم يكن هناك context.
   * استخدم getTenantId() عند الحاجة لتأكيد الوجود (يرمي exception).
   */
  tryGetTenantId(): string | null {
    return storage.getStore()?.tenantId ?? null;
  },
};
