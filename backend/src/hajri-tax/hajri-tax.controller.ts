/**
 * رابط تشغيل تطبيق HAJRI TAX مع تمرير التوكن من الخادم (لا يُعرَض في الواجهة).
 * يتطلّب دور owner فقط — يتماشى مع إظهار الرابط في الشريط الجانبي للمالك.
 */
import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';

@Controller('owner/hajri-tax')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('owner')
export class HajriTaxController {
  /**
   * يعيد { url } لفتح تطبيق الضرائب.
   * إن وُجدت HAJRI_TAX_APP_ID و HAJRI_TAX_ACCESS_TOKEN يُضافان كاستعلام (دخول مباشر).
   * وإلا يُعاد الرابط الأساسي فقط (سلوك سابق: يطلب تسجيل الدخول في Hajri).
   */
  @Get('launch-url')
  getLaunchUrl(): { url: string } {
    const base = (process.env.HAJRI_TAX_BASE_URL || 'https://hajrix.com/tax').replace(/\/$/, '');
    const appId = process.env.HAJRI_TAX_APP_ID?.trim();
    const accessToken = process.env.HAJRI_TAX_ACCESS_TOKEN?.trim();
    if (!appId || !accessToken) {
      return { url: `${base}/` };
    }
    const u = new URL(`${base}/`);
    u.searchParams.set('app_id', appId);
    u.searchParams.set('access_token', accessToken);
    return { url: u.toString() };
  }
}
