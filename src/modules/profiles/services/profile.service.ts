import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { DBHelper } from 'src/modules/helpers/services/db-helper';
import { PrismaService } from 'src/modules/prisma/services/prisma.service';
import { CreateProfileDto } from '../dto/create-profile.dto';
import { UpdateProfileDto } from '../dto/update-profile.dt';
import { Prisma, Profile } from '@prisma/client';
import { AppError } from 'src/exceptions/app.exception';
import { PaginatedDataResult } from 'src/types/types';

@Injectable()
export class ProfilesService {
  private readonly context = ProfilesService.name;
  private readonly logger = new Logger(this.context);
  constructor(
    private readonly dbHelper: DBHelper,
    private readonly prisma: PrismaService,
  ) {}

  async getOne(where: Prisma.UserWhereUniqueInput) {
    try {
      const modelName = 'user';
      return await this.dbHelper.findOne<typeof modelName, Profile>({
        model: modelName,
        where: where,
      });
    } catch (error) {
      this.logger.error(
        `Error finding profile that match with ${JSON.stringify(where)}:`,
        error,
      );
      throw new AppError(
        `Error finding profile that match with ${JSON.stringify(where)}`,
        HttpStatus.NOT_FOUND,
        this.context,
        error,
      );
    }
  }

  async getAll(
    page: number = 1,
    pageSize: number = 10,
    cursor?: Prisma.ProfileWhereUniqueInput,
    where?: Prisma.ProfileWhereInput,
    orderBy?: Prisma.ProfileOrderByWithRelationInput,
    select?: Prisma.ProfileSelect,
  ): Promise<PaginatedDataResult<Profile>> {
    const modelName = 'profile';
    return this.dbHelper.getPaginatedData({
      model: modelName,
      page,
      pageSize,
      cursor,
      where,
      orderBy,
      select,
    });
  }

  async createProfile(data: CreateProfileDto) {
    try {
      // Validate and transform the data using the Zod schema
      return await this.prisma.profile.create({
        // Map DTO fields to Prisma model fields
        data,
      });
    } catch (error) {
      this.logger.error('Error creating profile:', error);
      throw error;
    }
  }

  async updateProfile(id: number, data: UpdateProfileDto) {
    try {
      // Validate and transform the data using the Zod schema
      return await this.prisma.profile.update({
        where: { id },
        // Map DTO fields to Prisma model fields
        data,
      });
    } catch (error) {
      this.logger.error('Error updating profile:', error);
      throw error;
    }
  }

  async deleteProfile(id: number) {
    try {
      return await this.prisma.profile.delete({
        where: { id },
      });
    } catch (error) {
      this.logger.error('Error deleting profile:', error);
      throw error;
    }
  }
}
