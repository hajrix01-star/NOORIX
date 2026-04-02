import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  async getHealth() {
    return this.appService.getHealth();
  }

  @Get('gemini-test')
  @UseGuards(AuthGuard('jwt'))
  async testGemini() {
    return this.appService.testGemini();
  }
}
