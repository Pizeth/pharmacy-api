import { Controller } from '@nestjs/common';
import { ProfilesService } from '../services/profile.service';

@Controller('profiles')
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}
}
