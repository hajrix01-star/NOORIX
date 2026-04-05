import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RolesService } from './roles.service';

@Controller('roles')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  /** المصفوفة الكاملة — أي مستخدم مصادق يستطيع جلبها */
  @Get('permissions-schema')
  getPermissionsSchema() {
    return this.rolesService.getPermissionsSchema();
  }

  @Get()
  @Roles('owner', 'super_admin')
  findAll() {
    return this.rolesService.findAll();
  }

  @Post()
  @Roles('owner', 'super_admin')
  create(
    @Body() body: { name: string; nameAr?: string; description?: string; permissions: string[] },
  ) {
    return this.rolesService.create(body);
  }

  @Patch(':id')
  @Roles('owner', 'super_admin')
  update(
    @Param('id') id: string,
    @Body() body: { nameAr?: string; description?: string; permissions?: string[] },
  ) {
    return this.rolesService.update(id, body);
  }

  @Delete(':id')
  @Roles('owner', 'super_admin')
  remove(@Param('id') id: string) {
    return this.rolesService.remove(id);
  }
}
