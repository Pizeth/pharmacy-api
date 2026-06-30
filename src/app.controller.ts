// import { Controller, Get } from '@nestjs/common';
// import { AppService } from './app.service';

// @Controller()
// export class AppController {
//   constructor(private readonly appService: AppService) {}

//   @Get()
//   getHello(): string {
//     return this.appService.getHello();
//   }
// }

import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { AppService } from 'app.service';

// @Controller({ version: '1' })
@Controller({ path: '', version: VERSION_NEUTRAL }) // 👈 no version prefix
export class AppController {
  constructor(private readonly service: AppService) {}

  @AllowAnonymous()
  @Get() // 👈 Matches exactly: http://localhost:3000/
  getInfo() {
    return this.service.getInfo();
  }
}
