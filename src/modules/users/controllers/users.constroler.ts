import {
  Controller,
  Get,
  Param,
  Post,
  Body,
  Logger,
  UseInterceptors,
  //   Put,
  //   Delete,
} from '@nestjs/common';
// import { UsersService } from './user.service';
import { Prisma, User, User as UserModel } from '@prisma/client';
import { PaginatedDataResult } from 'src/types/types';
import { UsersService } from '../services/users.service';
import { ApiCreatedResponse, ApiTags, ApiConsumes } from '@nestjs/swagger';
import { CreateUserDto, createUserSchema } from '../dto/create-user.dto';
import { ZodValidationPipe } from 'nestjs-zod';
import { ValidateFile } from 'src/decorators/validate-upload.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
// import { PaginatedDataResult } from './types/types';
@ApiTags('Users') // Swagger tag for grouping endpoints
@Controller({ path: 'users', version: '1' })
export class UserController {
  private readonly logger = new Logger(UserController.name);
  constructor(private readonly service: UsersService) {}

  // @Get('post/:id')
  // async getPostById(@Param('id') id: string): Promise<PostModel> {
  //   return this.postService.post({ id: Number(id) });
  // }

  // @Get('feed')
  // async getPublishedPosts(): Promise<PostModel[]> {
  //   return this.postService.posts({
  //     where: { published: true },
  //   });
  // }

  // @Get('filtered-posts/:searchString')
  // async getFilteredPosts(
  //   @Param('searchString') searchString: string,
  // ): Promise<PostModel[]> {
  //   return this.postService.posts({
  //     where: {
  //       OR: [
  //         {
  //           title: { contains: searchString },
  //         },
  //         {
  //           content: { contains: searchString },
  //         },
  //       ],
  //     },
  //   });
  // }

  // @Post('post')
  // async createDraft(
  //   @Body() postData: { title: string; content?: string; authorEmail: string },
  // ): Promise<PostModel> {
  //   const { title, content, authorEmail } = postData;
  //   return this.postService.createPost({
  //     title,
  //     content,
  //     author: {
  //       connect: { email: authorEmail },
  //     },
  //   });
  // }

  // The controller is now incredibly clean.
  // The global pipe handles validation automatically.
  // Swagger knows about CreateUserDto because it's a class with generated decorators.
  @Post()
  // Tell Swagger to expect a multipart/form-data request
  @ApiConsumes('multipart/form-data')
  @ApiCreatedResponse({
    description: 'The user has been successfully created.',
  })
  @UseInterceptors(FileInterceptor('avatar'))
  async create(
    @Body(new ZodValidationPipe(createUserSchema))
    createUserDto: CreateUserDto,
    // Your clean, custom @ValidateFile decorator is now applied to the parameter.
    @ValidateFile({
      fileIsRequired: false, // Example: make the avatar optional
      maxSize: 5 * 1024 * 1024, // 5MB
      allowedMimeTypes: ['image/jpeg', 'image/png'],
    })
    file?: Express.Multer.File, // The type comes from `@types/multer`
  ) {
    // The DTO is validated and fully typed, just like before.
    this.logger.debug(createUserDto);
    try {
      const result = await this.service.create(createUserDto, file);
      return {
        message: '👤User ${result.username} created successfully!✔️',
        user: result,
      };
    } catch (error: unknown) {
      this.logger.error('Error creating user:', error);
      // Handle the error appropriately, e.g., throw a custom exception
      // throw error; // Or return a custom error response
    }
  }

  // @Post('with-avatar')
  // @ApiConsumes('multipart/form-data')
  // // The @UseInterceptors decorator is applied to the method, as required.
  // @UseInterceptors(FileInterceptor('avatar'))
  // async createUserWithAvatar(
  //   // The @Body() decorator is now clean. The global pipe will handle validation.
  //   @Body() createUserDto: CreateUserWithAvatarDto,

  //   // Your clean, custom @ValidateFile decorator is applied to the parameter.
  //   @ValidateFile({
  //     fileIsRequired: false, // Example: make the avatar optional
  //     maxSize: 5 * 1024 * 1024, // 5MB
  //     allowedMimeTypes: ['image/jpeg', 'image/png'],
  //   })
  //   avatarFile?: Express.Multer.File,
  // ) {
  //   console.log('Validated Text Data:', createUserDto);
  //   console.log('Uploaded File Info:', avatarFile);

  //   // Your service logic here...

  //   return {
  //     message: 'User and avatar received successfully!',
  //     userData: createUserDto,
  //     fileName: avatarFile?.originalname,
  //   };
  // }

  @Get(':id')
  async getUserById(@Param('id') id: string): Promise<UserModel | null> {
    return this.service.getOne({ id: Number(id) });
  }

  @Get(':params')
  async getUsersByParams(
    @Param('params') params: Prisma.UserWhereUniqueInput,
  ): Promise<User | null> {
    return this.service.getOne(params);
  }

  @Get()
  async getAllUsers(): Promise<PaginatedDataResult<User>> {
    return this.service.getAll();
  }

  @Post()
  async signupUser(
    @Body() userData: Prisma.UserCreateInput,
  ): Promise<UserModel> {
    return this.service.createUser(userData);
  }
}
