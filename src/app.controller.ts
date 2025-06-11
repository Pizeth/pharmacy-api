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

import {
  Controller,
  Get,
  Param,
  Post,
  Body,
  Put,
  Delete,
} from '@nestjs/common';
import { UsersService } from './user.service';
import { Prisma, User, User as UserModel } from '@prisma/client';
import { get } from 'http';
import { PaginatedDataResult } from './types/types';

@Controller()
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

  @Get('user/:id')
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

  @Post('user')
  async signupUser(
    @Body() userData: Prisma.UserCreateInput,
  ): Promise<UserModel> {
    return this.userService.createUser(userData);
  }

  // @Put('publish/:id')
  // async publishPost(@Param('id') id: string): Promise<PostModel> {
  //   return this.postService.updatePost({
  //     where: { id: Number(id) },
  //     data: { published: true },
  //   });
  // }

  // @Delete('post/:id')
  // async deletePost(@Param('id') id: string): Promise<PostModel> {
  //   return this.postService.deletePost({ id: Number(id) });
  // }
}
