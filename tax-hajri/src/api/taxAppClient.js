/**
 * عميل الواجهة الخلفية لتطبيق HAJRI TAX (كيانات، مصادقة، سجلات).
 */
import { createClient } from 'hajri-sdk';
import { appParams } from '@/lib/app-params';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

export const taxAppClient = createClient({
  appId,
  token,
  functionsVersion,
  serverUrl: '',
  requiresAuth: false,
  appBaseUrl,
});
