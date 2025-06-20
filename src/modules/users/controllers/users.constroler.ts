import {
  Controller,
  Get,
  Param,
  Post,
  Body,
  HttpStatus,
  //   Put,
  //   Delete,
} from '@nestjs/common';
// import { UsersService } from './user.service';
import { Prisma, User, User as UserModel } from '@prisma/client';
import { PaginatedDataResult } from 'src/types/types';
import { UsersService } from '../services/users.service';
import { ApiCreatedResponse, ApiTags } from '@nestjs/swagger';
import { CreateUserDto } from '../dto/create-user.dto';
// import { PaginatedDataResult } from './types/types';
@ApiTags('Users') // Swagger tag for grouping endpoints
@Controller({ path: 'users', version: '1' })
export class UserController {
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
  @ApiCreatedResponse({
    description: 'The user has been successfully created.',
  })
  async create(@Body() createUserDto: CreateUserDto) {
    // The DTO is validated and fully typed, just like before.
    console.log(createUserDto);
    const result = await this.service.create(createUserDto);
    return {
      message: 'User created successfully!',
      user: result,
    };
  }

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
