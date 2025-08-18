import { Controller, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { OidcProviderService } from '../services/oidc-provider.service';
import { CreateProviderDto } from '../dto/create-provider.dto';
import { UpdateProviderDto } from '../dto/update-provider.dto';

@Controller('admin/providers')
export class ProviderController {
  constructor(private providerService: OidcProviderService) {}

  @Post()
  async createProvider(@Body() data: CreateProviderDto) {
    return this.providerService.createAndRegisterProvider(data);
  }

  @Patch(':id')
  async updateProvider(
    @Param('id') id: string,
    @Body() data: UpdateProviderDto,
  ) {
    return this.providerService.updateAndReregisterProvider(parseInt(id), data);
  }

  @Delete(':id')
  async deleteProvider(@Param('id') id: string) {
    return this.providerService.deleteAndUnregisterProvider(parseInt(id));
  }

  @Post(':id/enable')
  async enableProvider(
    @Param('id') id: string,
    @Body() data: { enabled: boolean },
  ) {
    const provider = await this.providerService.updateAndReregisterProvider(
      parseInt(id),
      { enabled: data.enabled },
    );
    return provider;
  }
}
