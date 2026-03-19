import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('super_admin', 'owner')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Post()
  create(
    @Body()
    body: {
      email: string;
      password: string;
      nameAr?: string;
      nameEn?: string;
      roleName: string;
      companyIds: string[];
    },
  ) {
    return this.usersService.create(body);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() body: { nameAr?: string; nameEn?: string; roleName?: string; password?: string; companyIds?: string[] },
    @Req() req: { user: { userId: string } },
  ) {
    return this.usersService.update(id, body, req.user.userId);
  }

  @Patch(':id/archive')
  archive(@Param('id') id: string, @Req() req: { user: { userId: string } }) {
    return this.usersService.archive(id, req.user.userId);
  }

  @Patch(':id/restore')
  restore(@Param('id') id: string) {
    return this.usersService.restore(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: { user: { userId: string } }) {
    return this.usersService.remove(id, req.user.userId);
  }
}
