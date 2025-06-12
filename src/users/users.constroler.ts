import {
  Controller,
  Get,
  Param,
  Post,
  Body,
  //   Put,
  //   Delete,
} from '@nestjs/common';
// import { UsersService } from './user.service';
import { Prisma, User, User as UserModel } from '@prisma/client';
import { PaginatedDataResult } from 'src/types/types';
import { UsersService } from './services/users.service';
// import { PaginatedDataResult } from './types/types';

@Controller({ path: 'users', version: '1' })
export class AppController {
  constructor(private readonly userService: UsersService) {}

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

  @Get('users/:id')
  async getUserById(@Param('id') id: string): Promise<UserModel | null> {
    return this.userService.user({ id: Number(id) });
  }

  @Get('users/:params')
  async getUsersByParams(
    @Param('params') params: Prisma.UserWhereUniqueInput,
  ): Promise<User | null> {
    return this.userService.user(params);
  }

  @Get('users')
  async getAllUsers(): Promise<PaginatedDataResult<User>> {
    return this.userService.users();
  }

  @Post('users')
  async signupUser(
    @Body() userData: Prisma.UserCreateInput,
  ): Promise<UserModel> {
    return this.userService.createUser(userData);
  }
}
