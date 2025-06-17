import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/services/prisma.service';
import { Prisma, User } from '@prisma/client';
import { DBHelper } from '../../helpers/services/db-helper';
import { PaginatedDataResult } from '../../../types/types';
import { PasswordUtils } from 'src/commons/services/password-utils.service';
import { CreateUserDto } from '../dto/create-user.dto';
import { ObjectOmitter } from 'src/commons/services/object-utils.service';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  constructor(
    private prisma: PrismaService,
    private readonly dbHelper: DBHelper,
    private readonly passwordUtils: PasswordUtils, // Inject your service here
  ) {}

  // async user(
  //   userWhereUniqueInput: Prisma.UserWhereUniqueInput,
  // ): Promise<User | null> {
  //   try {
  //     return await this.prisma.user.findUnique({
  //       where: userWhereUniqueInput,
  //       include: {
  //         profile: true,
  //       },
  //     });
  //   } catch (error) {
  //     console.error(
  //       `Error finding user with ${JSON.stringify(userWhereUniqueInput)}:`,
  //       error,
  //     );
  //     throw error;
  //   }
  // }

  async getOne(where: Prisma.UserWhereUniqueInput): Promise<User | null> {
    try {
      const modelName = 'user';
      return await this.dbHelper.findOne<typeof modelName, User>({
        model: modelName,
        where: where,
        include: {
          profile: true,
          role: true,
          refreshTokens: true,
          auditTrail: true,
        },
      });
    } catch (error) {
      console.error(`Error finding user with ${JSON.stringify(where)}:`, error);
      throw error;
    }
  }

  // async users(params: {
  //   model: 'user';
  //   skip?: number;
  //   take?: number;
  //   cursor?: Prisma.UserWhereUniqueInput;
  //   where?: Prisma.UserWhereInput;
  //   orderBy?: Prisma.UserOrderByWithRelationInput;
  // }): Promise<User[]> {
  //   const { skip, take, cursor, where, orderBy } = params;
  //   return this.prisma.user.findMany({
  //     skip,
  //     take,
  //     cursor,
  //     where,
  //     orderBy,
  //   });
  // }

  async getAll(
    page: number = 1,
    pageSize: number = 10,
    cursor?: Prisma.UserWhereUniqueInput,
    where?: Prisma.UserWhereInput,
    orderBy?: Prisma.UserOrderByWithRelationInput,
    select?: Prisma.UserSelect,
  ): Promise<PaginatedDataResult<User>> {
    const modelName = 'user';
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

  async create(createUserDto: CreateUserDto) {
    // Destructure the DTO to separate the password from the rest of the data.
    // The `repassword` field is not present here because the Zod schema doesn't include it in its output.
    const { password, ...userData } = createUserDto;

    // Use your injected PasswordUtils service to hash the password.
    const hashedPassword = await this.passwordUtils.hash(password);

    // Create the user in the database with the hashed password.
    const newUser = await this.prisma.user.create({
      data: {
        ...userData,
        password: hashedPassword, // Use the hashed password
        // ... any other required fields for user creation
      },
    });

    // Best practice: don't return the password hash in the response.
    // Use the omit helper function for a cleaner approach
    const result = ObjectOmitter.omit(newUser, 'password');

    this.logger.debug(result);

    return result;
  }

  /**
   * Get a paginated list of users with basic information.
   * Demonstrates simple pagination and ordering.
   */
  async getActiveUsers(
    page: number = 1,
    pageSize: number = 10,
    orderBy: Prisma.UserOrderByWithRelationInput = { createdDate: 'desc' },
  ): Promise<PaginatedDataResult<User>> {
    // Type assertion for model name
    const modelName = 'user';
    // const modelName = 'user' as Prisma.ModelName;

    return await this.dbHelper.getPaginatedData<typeof modelName, User>({
      model: modelName,
      page,
      pageSize,
      where: {
        enabledFlag: true, // Only active users
        isBan: false, // Not banned
        deletedAt: null, // Not soft-deleted
      },
      orderBy,
      select: {
        id: true,
        username: true,
        email: true,
        roleId: true,
        avatar: true,
        lastLogin: true,
      },
      include: {
        profile: true, // Include profile information if needed
        role: true, // Include role information if needed
      },
    });
  }

  /**
   * Find users by a search term (username or email).
   * Demonstrates filtering with 'OR' and 'contains'.
   */
  async findByTerms(
    searchTerm: string,
    page: number = 1,
    pageSize: number = 5,
  ): Promise<PaginatedDataResult<User>> {
    const modelName = 'user';
    return await this.dbHelper.getPaginatedData<typeof modelName, User>({
      model: modelName,
      page,
      pageSize,
      where: {
        enabledFlag: true,
        deletedAt: null,
        OR: [
          { username: { contains: searchTerm, mode: 'insensitive' } },
          { email: { contains: searchTerm, mode: 'insensitive' } },
        ],
      },
      orderBy: { username: 'asc' },
      select: {
        id: true,
        username: true,
        email: true,
        roleId: true,
      },
    });
  }

  /**
   * Get users with advanced filtering and complex ordering.
   * For example, find 'ADMIN' users who haven't logged in for a while,
   * ordered by their last login date and then by username.
   */
  async getAdminsToReview(
    lastLoginThreshold: Date,
    page: number = 1,
    pageSize: number = 10,
  ): Promise<PaginatedDataResult<User>> {
    const modelName = 'user';

    return await this.dbHelper.getPaginatedData<typeof modelName, User>({
      model: modelName,
      page,
      pageSize,
      where: {
        // role: 'ADMIN', // Assuming 'ADMIN' is a value in your Role enum
        enabledFlag: true,
        isBan: false,
        OR: [
          { lastLogin: { lt: lastLoginThreshold } },
          { lastLogin: null }, // Also include those who never logged in
        ],
      },
      orderBy: [
        { lastLogin: 'asc' }, // Admins who logged in longest ago first
        { username: 'asc' },
      ],
      select: {
        id: true,
        username: true,
        email: true,
        lastLogin: true,
        roleId: true,
      },
    });
  }

  /**
   * Get users using cursor-based pagination.
   * Useful for infinite scrolling or stable pagination.
   * The 'cursorId' would typically come from the last item of the previous fetch.
   */
  async getUsersWithCursor(
    pageSize: number = 10,
    cursorId?: number, // The ID of the user to start after
  ): Promise<PaginatedDataResult<User>> {
    const modelName = 'user';

    let cursorArg: Prisma.UserWhereUniqueInput | undefined = undefined;
    if (cursorId) {
      cursorArg = { id: cursorId };
    }

    return await this.dbHelper.getPaginatedData<typeof modelName, User>({
      model: modelName,
      pageSize,
      cursor: cursorArg,
      where: {
        enabledFlag: true,
        deletedAt: null,
      },
      orderBy: { id: 'asc' }, // Cursor pagination requires a stable, unique order
      select: {
        id: true,
        username: true,
        email: true,
        roleId: true,
      },
    });
  }

  /**
   * Get a single user by their ID, potentially including their profile.
   * This method doesn't use getPaginatedData but shows interaction with PrismaService
   * for a common use case that might be alongside your paginated methods.
   * For this, you'd typically use prisma.user.findUnique directly.
   * However, if you wanted to use getPaginatedData to fetch a single user by unique criteria:
   */
  async getUserByIdWithDbHelper(userId: number): Promise<User | null> {
    const modelName = 'user';

    // Using getPaginatedData to fetch a single user (less common for findUnique scenarios)
    const result = await this.dbHelper.getPaginatedData<typeof modelName, User>(
      {
        model: modelName,
        pageSize: 1, // We only want one user
        where: { id: userId, deletedAt: null },
        select: {
          // Or use 'include' if you have a 'profile' relation defined
          id: true,
          username: true,
          email: true,
          roleId: true,
          avatar: true,
          lastLogin: true,
          // profile: true, // If 'profile' is a relation and you want to include it
        },
        // include: { profile: true } // Alternative if 'profile' is a relation
      },
    );

    if (result.data.length > 0) {
      return result.data[0];
    }
    return null; // Or throw NotFoundException
  }

  // static async findUsers(
  //   model: 'user',
  //   page: number,
  //   pageSize: number,
  //   orderBy: Prisma.UserOrderByWithRelationInput,
  //   orderDirection: 'asc' | 'desc' = 'asc',
  // ) {
  //   try {
  //     const result = await pagination.getPaginatedData({
  //       model: 'user',
  //       page: parseInt(page) || 1,
  //       pageSize: parseInt(pageSize) || 10,
  //       orderBy,
  //       orderDirection,
  //       include: {
  //         profile: true,
  //         // refreshTokens: true,
  //       },
  //     });
  //     result.data.map((data) => new User(data));
  //     return result;
  //   } catch (error) {
  //     console.error('Error fetching paginated users:', error);
  //     throw error;
  //   }
  // }

  async createUser(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({
      data,
    });
  }

  async updateUser(params: {
    where: Prisma.UserWhereUniqueInput;
    data: Prisma.UserUpdateInput;
  }): Promise<User> {
    const { where, data } = params;
    return this.prisma.user.update({
      data,
      where,
    });
  }

  async deleteUser(where: Prisma.UserWhereUniqueInput): Promise<User> {
    return this.prisma.user.delete({
      where,
    });
  }
}
