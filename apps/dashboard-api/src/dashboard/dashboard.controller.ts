import { Controller, Get } from '@nestjs/common';

@Controller('dashboard')
export class DashboardController {
  @Get()
  getDashboard(): void {
    // Placeholder — to be implemented
  }
}
