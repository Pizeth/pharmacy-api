import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/services/prisma.service';
import { AuditActionType, AuditTargetType, Prisma, User } from '@prisma/client';
import { DBHelper } from '../../helpers/services/db-helper';
import { PaginatedDataResult } from '../../../types/types';
import { PasswordUtils } from 'src/commons/services/password-utils.service';
import { CreateUserDto } from '../dto/create-user.dto';
import { R2Service } from 'src/modules/files/services/cloudflare-r2.service';
import { AppError } from 'src/exceptions/app.exception';
import { FileUtil } from 'src/utils/file.util';
import { ClsService } from 'nestjs-cls';
// import { ImagePlaceHolderService } from 'src/modules/images/services/images.service';
import { DiceBearStyle, type } from 'src/types/commons.enum';
import { ImagesService } from 'src/modules/images/services/images.service';
import { UserDetail } from 'src/types/dto';

@Injectable()
export class UsersService {
  private readonly context = UsersService.name;
  private readonly logger = new Logger(this.context);
  constructor(
    private readonly prisma: PrismaService,
    private readonly dbHelper: DBHelper,
    private readonly passwordUtils: PasswordUtils, // Inject your service here
    private readonly fileService: R2Service, // Assuming you have a file service for handling files
    private readonly imageService: ImagesService,
    private readonly cls: ClsService,
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

  /**
   * Retrieves a user by email or username.
   *
   * Searches for a user in the database whose email (case-insensitive) or username matches the provided input.
   * Includes related profile, role, refresh tokens, and audit trail information in the result.
   *
   * @param input - The email or username to search for.
   * @returns A promise that resolves to the found {@link User} object or `null` if no user is found.
   * @throws {AppError} If an error occurs during the database query.
   */
  async getUser(input: string): Promise<UserDetail | null> {
    try {
      const result = await this.prisma.user.findFirst({
        where: {
          OR: [
            { email: { equals: input, mode: 'insensitive' } },
            { username: input },
          ],
        },
        include: {
          profile: true,
          role: true,
          refreshTokens: true,
          auditTrail: true,
        },
      });
      return result as UserDetail | null;
    } catch (error) {
      this.logger.error(`Error finding user ${input}:`, error);
      throw new AppError(
        `Error finding user that match with ${input}`,
        HttpStatus.NOT_FOUND,
        this.context,
        error,
      );
    }
  }

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
      this.logger.error(
        `Error finding user with ${JSON.stringify(where)}:`,
        error,
      );
      throw new AppError(
        `Error finding user that match with ${JSON.stringify(where)}`,
        HttpStatus.NOT_FOUND,
        this.context,
        error,
      );
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

  /**
   * Creates a new user in the system.
   *
   * This function handles the creation of a new user with the provided data,
   * including optional file handling for avatar uploads. It ensures that the
   * username and email are unique before proceeding with the user creation
   * transaction. If a file is provided, it attempts to upload it as the user's
   * avatar. The password is securely hashed before being stored.
   *
   * @param createUserDto - The data transfer object containing user details.
   * @param file - An optional file representing the user's avatar.
   *
   * @returns A promise that resolves to the created user object, excluding the password.
   *
   * @throws {AppError} If the username or email already exists, or if an error
   * occurs during user creation.
   */
  async create(
    createUserDto: CreateUserDto,
    file?: Express.Multer.File,
  ): Promise<Omit<User, 'password'>> {
    const username = createUserDto.username;
    const fileName = FileUtil.generateFileName(createUserDto.username, file);
    try {
      return this.prisma.$transaction(
        async (tx) => {
          // Check unique constraints within transaction
          const [existingUsername, existingEmail] = await Promise.all([
            this.getOne({ username }),
            this.getOne({ email: createUserDto.email }),
          ]);

          if (existingUsername) {
            throw new AppError(
              `Username ${createUserDto.username} already exists!`,
              HttpStatus.CONFLICT,
              UsersService.name,
              {
                ACTION: 'Register New User',
                ROOT: 'Duplicate Data!',
                FIELD: 'username',
                CODE: 'DUPLICATE_USERNAME',
                VALUE: createUserDto.username,
              },
            );
          }

          if (existingEmail) {
            throw new AppError(
              `Email ${createUserDto.email} already exists!`,
              HttpStatus.CONFLICT,
              UsersService.name,
              {
                ACTION: 'Register New User',
                ROOT: 'Duplicate Data!',
                FIELD: 'email',
                CODE: 'DUPLICATE_EMAIL',
                VALUE: createUserDto.email,
              },
            );
          }

          // Handle file upload if provided
          // if (file) {
          //   const avatar = await this.fileService.uploadFile(file, fileName);
          //   createUserDto.avatar =
          //     avatar &&
          //     avatar.type === type.Upload &&
          //     avatar.status === HttpStatus.CREATED
          //       ? avatar.url
          //       : placeholderImage;
          // } else {
          //   createUserDto.avatar =
          //     this.imageService.generateImage(placeholderImage);
          // }

          const placeholderImage = this.imageService.getUrl(
            DiceBearStyle.Initials,
            createUserDto.username,
          );

          createUserDto.avatar = file
            ? await this.fileService
                .uploadFile(file, fileName)
                .then((avatar) =>
                  avatar &&
                  avatar.type === type.Upload &&
                  avatar.status === HttpStatus.CREATED
                    ? avatar.url
                    : placeholderImage,
                )
            : placeholderImage;

          // After validation succeeds, transform the object by creating a mutable copy of the validated data.
          const userData = createUserDto;
          // Explicitly delete the 'repassword' property. This is clean and avoids all linting warnings.
          delete (userData as { repassword?: string }).repassword; // Cleanly remove the repassword field

          // Use injected PasswordUtils service to hash the password.
          const hashedPassword = await this.passwordUtils.hash(
            userData.password,
          );

          this.logger.debug('User data:', userData);

          // Create user with more detailed error tracking
          return tx.user.create({
            data: {
              ...userData,
              password: hashedPassword, // Use the hashed password
              // Add audit trail information
              auditTrail: {
                create: {
                  action: AuditActionType.CREATE,
                  targetType: AuditTargetType.User,
                  targetId: '0', // Placeholder.
                  userAgent: 'SYSTEM',
                  timestamp: new Date(),
                  ipAddress: this.cls.get<string>('ip') || '',
                  description: 'DEFAULT_ADMIN_SEEDED',
                },
              },
            },
          });
        },
        {
          maxWait: 5000, // default: 2000
          timeout: 25000, // default: 5000
        },
      );

      // Best practice: don't return the password hash in the response.
      // Use the omit helper function for a cleaner approach
      // const result = ObjectOmitter.omit(newUser, 'password');

      // this.logger.debug(result);

      // return result;

      // return await prisma.$transaction(
      //   async (tx) => {
      //     // Check unique constraints within transaction
      //     const [existingUsername, existingEmail] = await Promise.all([
      //       UserRepo.findByUsername(data.username),
      //       UserRepo.findByEmail(data.email),
      //     ]);

      //     if (existingUsername) {
      //       throw new Error('Username already exists');
      //     }

      //     if (existingEmail) {
      //       throw new Error('Email already exists');
      //     }

      //     const avatar = await upload.uploadFile(req, res, user.username);
      //     if (avatar && avatar.status === 200) {
      //       fileName = avatar.fileName;
      //       user.update({
      //         avatar: avatar.url,
      //       });
      //     }

      //     // Create user with more detailed error tracking
      //     const newUser = await tx.user.create({
      //       data: {
      //         ...user.toNew(),
      //         password: passwordUtils.hash(data.password),
      //         // Add audit trail information
      //         auditTrail: {
      //           create: {
      //             action: 'REGISTER',
      //             timestamp: new Date(),
      //             ipAddress: req.ip,
      //           },
      //         },
      //       },
      //     });

      //     // console.log(await newUser);
      //     return new User(newUser);
      //   },
      //   {
      //     maxWait: 5000, // default: 2000
      //     timeout: 10000, // default: 5000
      //   },
      // );
    } catch (error: unknown) {
      this.logger.error('jom yeak error!', error);
      this.logger.debug('File name:', fileName);
      if (fileName) {
        try {
          const deleteResponse = await this.fileService.deleteFile(fileName);
          console.warn(`Rolled back uploaded file: ${deleteResponse.fileName}`);
        } catch (deleteError) {
          console.error('Error rolling back file:', deleteError);
        }
      }
      // Centralized error logging
      // logError('User Registration', error, req);
      throw error; // Re-throw the error for further handling
    }

    // // Destructure the DTO to separate the password from the rest of the data.
    // // The `repassword` field is not present here because the Zod schema doesn't include it in its output.
    // const { password, ...userData } = createUserDto;

    // // Use your injected PasswordUtils service to hash the password.
    // const hashedPassword = await this.passwordUtils.hash(password);

    // // Create the user in the database with the hashed password.
    // const newUser = await this.prisma.user.create({
    //   data: {
    //     ...userData,
    //     password: hashedPassword, // Use the hashed password
    //     // ... any other required fields for user creation
    //   },
    // });

    // // Best practice: don't return the password hash in the response.
    // // Use the omit helper function for a cleaner approach
    // const result = ObjectOmitter.omit(newUser, 'password');

    // this.logger.debug(result);

    // return result;
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
