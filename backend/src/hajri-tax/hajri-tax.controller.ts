/**
 * رابط تشغيل تطبيق HAJRI TAX مع تمرير التوكن من الخادم (لا يُعرَض في الواجهة).
 * يتطلّب دور owner فقط — يتماشى مع إظهار الرابط في الشريط الجانبي للمالك.
 */
import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';

const DEFAULT_HAJRI_TAX_BASE = 'https://hajrix.com/tax';
const HAJRIX_TAX_ROOT_HOSTS = new Set(['hajrix.com', 'www.hajrix.com']);

/** يطابق الواجهة: جذر hajrix.com بدون ‎/tax‎ يفتح نوريكس في الإطار بدل تطبيق الضرائب. */
function normalizeHajriTaxBaseUrl(raw: string): string {
  const s = (raw?.trim() || DEFAULT_HAJRI_TAX_BASE).replace(/\/$/, '');
  try {
    const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(s);
    const u = new URL(hasScheme ? s : `https://${s}`);
    const p = u.pathname.replace(/\/$/, '') || '';
    if ((!p || p === '/') && HAJRIX_TAX_ROOT_HOSTS.has(u.hostname)) {
      u.pathname = '/tax';
    }
    return u.toString().replace(/\/$/, '');
  } catch {
    return DEFAULT_HAJRI_TAX_BASE;
  }
}

@Controller('owner/hajri-tax')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('owner', 'super_admin')
export class HajriTaxController {
  /**
   * يعيد { url } لفتح تطبيق الضرائب.
   * إن وُجدت HAJRI_TAX_APP_ID و HAJRI_TAX_ACCESS_TOKEN يُضافان كاستعلام (دخول مباشر).
   * يُضاف app_base_url عند ضبط HAJRI_TAX_APP_BASE_URL حتى يتصل SPA بخادم Hajri الصحيح (وليس /api على نفس الدومين فقط).
   * وإلا يُعاد الرابط الأساسي فقط (سلوك سابق: يطلب تسجيل الدخول في Hajri).
   */
  @Get('launch-url')
  getLaunchUrl(): { url: string } {
    const base = normalizeHajriTaxBaseUrl(process.env.HAJRI_TAX_BASE_URL || DEFAULT_HAJRI_TAX_BASE);
    const appId = process.env.HAJRI_TAX_APP_ID?.trim();
    const accessToken = process.env.HAJRI_TAX_ACCESS_TOKEN?.trim();
    const appBaseUrl = process.env.HAJRI_TAX_APP_BASE_URL?.trim();
    if (!appId || !accessToken) {
      return { url: `${base}/` };
    }
    const u = new URL(`${base}/`);
    u.searchParams.set('app_id', appId);
    u.searchParams.set('access_token', accessToken);
    if (appBaseUrl) {
      u.searchParams.set('app_base_url', appBaseUrl);
    }
    return { url: u.toString() };
  }
}
