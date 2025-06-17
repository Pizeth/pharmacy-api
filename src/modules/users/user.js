// models/user.js
import util from "util";
import passwordUtils from "../Utils/passwordUtils.js";
import z from "zod";
import { AppError } from "../Utils/responseHandler.js";
import statusCode from "http-status-codes";

// Utility function to format Zod errors
// Enhanced Zod error handling utility
function formatZodError(error) {
  return error.errors.map((err) => ({
    path: err.path.join("."), // Get the full path of the error
    message: err.message,
    code: err.code,
  }));
}

// Helper function for transforming role to uppercase
// Define the roles
const roles = ["SUPER_ADMIN", "ADMIN", "MANAGER", "CASHIER", "USER"];
// Create a schema for the role with transformation and validation
const roleSchema = z
  .string()
  .optional()
  .transform((val) => val.toUpperCase())
  .refine((val) => roles.includes(val), { message: "Invalid role" })
  .optional()
  .default("USER");

const usernameRegex = /^(?=.{5,50}$)[a-zA-Z](?!.*([_.])\1)[a-zA-Z0-9_.]*$/;

// Zod schema for user validation
export const UserSchema = z.object({
  id: z.coerce.number().int().nullable().optional(),
  username: z
    .string()
    .trim()
    .min(5, "Username must be at least 5 characters")
    .max(50, "Username must be at most 50 characters")
    .refine((username) => usernameRegex.test(username), {
      message:
        "Username must be at least 5 characters, start with a letter, and can contain letters, numbers, underscore, and dot!",
    }),
  email: z.string().email("Invalid email format"),
  password: z.string().refine(
    (password) => {
      // console.log(password);
      // If it's a bcrypt hash, consider it valid
      if (password.startsWith("$2") && password.length >= 60) {
        return true;
      } else if (passwordUtils.compare(process.env.PASSKEY, password)) {
        return true;
      }
      // Otherwise, apply the original regex
      return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/.test(
        password
      );
    },
    {
      message:
        "Password must be at least 8 characters, including uppercase, lowercase, number, and special character!",
    }
  ),
  newPassword: z
    .string()
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
      "Password must be at least 8 characters, include uppercase, lowercase, number, and special character!"
    )
    .nullable()
    .optional(),
  repassword: z.string().nullable().optional(),
  avatar: z.string().nullable().optional(),
  // profile: z.record(z.any()).nullable().optional(),
  profile: z
    .union([z.record(z.any()).nullable().optional(), z.literal("")])
    .optional(),
  // role: z
  //   .enum(["SUPER_ADMIN", "ADMIN", "MANAGER", "CASHIER", "USER"])
  //   .optional()
  //   .default("USER"),
  role: roleSchema,
  authMethod: z
    .enum([
      "PASSWORD",
      "GOOGLE",
      "MICROSOFT",
      "APPLE",
      "FACEBOOK",
      "TWITTER",
      "GITHUB",
    ])
    .optional()
    .default("PASSWORD"),
  mfaSecret: z.string().nullable().optional(),
  mfaEnabled: z.coerce.boolean().optional().default(false),
  loginAttempts: z.coerce.number().int().default(0),
  lastLogin: z.date().nullable().optional(),
  refreshTokens: z.array(z.record(z.any()).nullable()).optional(),
  isBan: z.coerce.boolean().optional().default(false),
  enabledFlag: z.coerce.boolean().optional().default(true),
  isLocked: z.coerce.boolean().optional().default(false),
  deletedAt: z.date().nullable().optional(),
  createdBy: z.coerce.number().int(),
  createdDate: z
    .date()
    .optional()
    .default(() => new Date())
    .nullable(),
  lastUpdatedBy: z.coerce.number().int(),
  lastUpdatedDate: z
    .date()
    .optional()
    .default(() => new Date())
    .nullable(),
  objectVersionId: z.coerce.number().int().default(1),
  auditTrail: z.array(z.record(z.any()).nullable().optional()).optional(),
});

// Schema for password matching validation
const PasswordMatchSchema = UserSchema.extend({
  password: UserSchema.shape.password,
  repassword: UserSchema.shape.repassword,
}).refine(
  (data) =>
    !data.password || !data.repassword || data.password === data.repassword,
  { message: "Passwords must match", path: ["repassword"] }
);

// Input schema for creation (exclude optional/generated fields)
export const CreateUserSchema = UserSchema.omit({
  id: true,
  createdDate: true,
  lastUpdatedDate: true,
  objectVersionId: true,
});

// Input schema for update (make all fields optional)
export const UpdateSchema = UserSchema.partial();

export const passwordSchema = UserSchema.pick({
  id: true,
  password: true,
  newPassword: true,
  repassword: true,
  createdDate: true,
  lastUpdatedBy: true,
  lastUpdatedDate: true,
}).superRefine(
  (data, context) => {
    // Password matching validation
    if (data.newPassword && data.newPassword !== null) {
      if (data.repassword !== data.newPassword) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Passwords do not match!",
          path: ["repassword"],
        });
      }
    }

    // Ensure new password is not the same as the old password
    if (passwordUtils.compare(data.newPassword, data.password)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "New Password and old Password can not be the same!",
        path: ["newPassword"],
      });
    }
    passwordUtils.hash(data.newPassword);
    // All validations passed
    return true;
  },
  {
    // This default message can be overridden by specific issues added above
    message: "Password validation failed",
  }
);

export class User {
  // Private field for storing password securely
  #password;
  #data;
  constructor(data = {}) {
    // console.log(data);
    try {
      // If password is already hashed, use it directly
      // Otherwise, hash the password if it's a plain text password
      const processedData = {
        ...data,
        // Check if password looks like a bcrypt hash
        // password:
        //   data.password &&
        //   (data.password.startsWith("$2") || data.password.length >= 60)
        //     ? data.password
        //     : data.password
        //     ? passwordUtils.hash(data.password)
        //     : data.passworded
        //     ? passwordUtils.hash(process.env.PASSKEY)
        //     : undefined,
        createdDate: data.createdDate ? new Date(data.createdDate) : new Date(),
        lastUpdatedDate: data.lastUpdatedDate
          ? new Date(data.lastUpdatedDate)
          : new Date(),
        lastLogin: data.lastLogin ? new Date(data.lastLogin) : null,
        deletedAt: data.deletedAt ? new Date(data.deletedAt) : null,
      };

      const validate = this.validate(processedData);

      // Validate and parse input data
      this.generateData(validate, processedData);
    } catch (error) {
      // if (error instanceof z.ZodError) {
      //   console.log(error);
      //   // Collect and throw validation errors
      //   const errorMessages = error.errors.map((err) => err.message);
      //   throw new Error(`Validation failed: ${errorMessages.join(", ")}`);
      // }

      if (error instanceof z.ZodError) {
        // Enhanced error handling with detailed path information
        const errorMessages = formatZodError(error);
        throw new Error(
          `Validation failed: ${JSON.stringify(errorMessages, null, 2)}`
        );
      }
      throw error;
    }
  }

  // Getter methods for accessing properties
  get id() {
    return this.#data.id;
  }
  get username() {
    return this.#data.username;
  }
  get email() {
    return this.#data.email;
  }
  get newPassword() {
    return this.#data.newPassword;
  }
  get repassword() {
    return this.#data.repassword;
  }
  get avatar() {
    return this.#data.avatar;
  }
  get profile() {
    return this.#data.profile;
  }
  get role() {
    return this.#data.role;
  }
  get authMethod() {
    return this.#data.authMethod;
  }
  get mfaSecret() {
    return this.#data.mfaSecret;
  }
  get mfaEnabled() {
    return this.#data.mfaEnabled;
  }
  get loginAttempts() {
    return this.#data.loginAttempts;
  }
  get lastLogin() {
    return this.#data.lastLogin;
  }
  get refreshTokens() {
    return this.#data.refreshTokens;
  }
  get isBan() {
    return this.#data.isBan;
  }
  get enabledFlag() {
    return this.#data.enabledFlag;
  }
  get isLocked() {
    return this.#data.isLocked;
  }
  get deletedAt() {
    return this.#data.deletedAt;
  }
  get createdBy() {
    return this.#data.createdBy;
  }
  get createdDate() {
    return this.#data.createdDate;
  }
  get lastUpdatedBy() {
    return this.#data.lastUpdatedBy;
  }
  get lastUpdatedDate() {
    return this.#data.lastUpdatedDate;
  }
  get objectVersionId() {
    return this.#data.objectVersionId;
  }
  get auditTrail() {
    return this.#data.auditTrail;
  }

  generateData(status, data) {
    // Status is valid, process the data normally
    if (status.isValid) {
      // console.log("status is valid");
      // console.log(data);

      if (
        data.repassword &&
        data.newPassword &&
        data.repassword !== data.newPassword
      ) {
        throw new AppError(
          "Passwords do not match!",
          statusCode.EXPECTATION_FAILED,
          status.errors
        );
      }
      if (
        data.repassword &&
        !data.newPassword &&
        data.repassword !== data.password
      ) {
        throw new AppError(
          "Passwords do not match!",
          statusCode.EXPECTATION_FAILED,
          status.errors
        );
      }

      // const PasswordMatchSchema = UserSchema.extend({
      //   password: UserSchema.shape.password,
      //   repassword: UserSchema.shape.repassword,
      // }).refine(
      //   (data) =>
      //     !data.password ||
      //     !data.repassword ||
      //     data.password === data.repassword,
      //   { message: "Passwords must match", path: ["repassword"] }
      // );

      this.#data = UserSchema.parse(data);

      const password = this.#data.password;

      // Securely store the password
      // this.#password = this.#data.password;
      this.#password =
        password && (password.startsWith("$2") || password.length >= 60)
          ? password
          : password
          ? passwordUtils.hash(password)
          : // : data.passworded
            // ? passwordUtils.hash(process.env.PASSKEY)
            undefined;

      // Remove password from the main data object
      this.removeCredential();
      return;
    }

    // Update user data: role, avatar, and lastUpdatedBy
    if (this.isUpdateSchema(data)) {
      console.log("update schema");
      this.#data = UpdateSchema.parse(data);

      // Remove password from the main data object
      this.removeCredential();
      return;
    }

    // Update only password
    if (this.isPasswordSchema(data)) {
      this.#data = passwordSchema.parse(data);
      this.#password = this.#data.password;

      // Remove password from the main data object
      delete this.#data.password;
      return;
    }

    const errorMessage =
      status.errors && status.errors.length > 0 && status.errors[0].message
        ? status.errors[0].message
        : "Failed to generate user's data!";

    // If no valid scenarios match, throw an error
    throw new AppError(
      errorMessage,
      statusCode.EXPECTATION_FAILED,
      status.errors
    );

    // throw new AppError(
    //   "Failed to generate user's data!",
    //   statusCode.EXPECTATION_FAILED,
    //   status.errors
    // );
  }

  // Secure method to check password without exposing it
  verifyPassword(inputPassword) {
    return passwordUtils.compare(inputPassword, this.#password);
  }

  verifyRepassword() {
    // console.log("new password:" + this.#data.newPassword);
    // console.log("re password:" + this.#data.repassword);
    // console.log(
    //   passwordUtils.check(this.#data.newPassword, this.#data.repassword)
    // );
    return passwordUtils.check(this.#data.newPassword, this.#data.repassword);
  }

  isPassworded() {
    return !!this.#password;
  }

  isUpdateSchema(data) {
    return data.id && data.role && data.lastUpdatedBy;
  }

  isPasswordSchema(data) {
    return (
      data.id &&
      data.password !== undefined &&
      data.newPassword &&
      data.repassword
    );
  }

  removeCredential() {
    delete this.#data.password;
    delete this.#data.newPassword;
    delete this.#data.repassword;
  }

  // Method to set a new password with hashing
  setPassword(password) {
    try {
      // Validate password first using Zod schema
      UserSchema.pick({ password: true }).parse({ password });

      // Hash and update password
      this.#password = passwordUtils.hash(password);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = formatZodError(error);
        throw new Error(
          `Password validation failed: ${JSON.stringify(
            errorMessages,
            null,
            2
          )}`
        );
      }
      throw error;
    }
  }

  // Validate method with enhanced error reporting
  validate(data) {
    try {
      // Reconstruct the full data object for validation
      const fullData = data
        ? data
        : { ...this.#data, password: this.#password };

      // UserSchema.superRefine((fullData, ctx) => {
      //   PasswordMatchSchema.parse(fullData);
      // });
      UserSchema.parse(fullData);
      return {
        isValid: true,
        errors: [],
      };
    } catch (error) {
      // console.error("Error:", formatZodError(error));
      if (error instanceof z.ZodError) {
        return {
          isValid: false,
          errors: formatZodError(error),
        };
      }
      throw error;
    }
  }

  // Method to update user data with validation
  update(updates = {}) {
    try {
      // Merge existing data with updates and re-validate
      const fullData = {
        ...this.#data,
        ...updates,
        password: this.#password,
        lastUpdatedDate: new Date(),
      };

      // console.log(fullData);
      const validate = this.validate(fullData);
      // Validate and parse input data
      this.generateData(validate, fullData);

      // this.#data = UserSchema.parse(fullData);

      // // Remove password from main data object again
      // // Remove password from the main data object
      // this.removeCredential();

      return this;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = formatZodError(error);
        throw new Error(
          `Update validation failed: ${JSON.stringify(errorMessages, null, 2)}`
        );
      }
      throw error;
    }
  }

  // Secure JSON serialization
  toJSON() {
    return {
      ...this.#data,
      createdDate: this.createdDate.toISOString(),
      lastUpdatedDate: this.lastUpdatedDate.toISOString(),
    };
  }

  // Method to get data ready for Prisma creation
  toData() {
    const passworded = this.isPassworded();
    const {
      profile,
      createdDate,
      lastUpdatedDate,
      objectVersionId,
      ...prismaInput
    } = {
      ...this.#data,
      passworded,
    };
    return prismaInput;
  }

  toNew() {
    const { id, passworded, ...newInput } = this.toData();
    return newInput;
  }

  [util.inspect.custom]() {
    return this.toJSON();
  }
}

// export default User;
export default User;

// export class User {
//   constructor(data = {}) {
//     const VALID_ROLES = ["USER", "ADMIN", "MODERATOR"];

//     this.id = Number(data?.id ?? null);
//     this.username = data.username || "";
//     this.email = data.email || "";
//     // this.password = data?.password ? this.hashPassword(data.password) : "";
//     this.password = data?.password ? data.password : "";
//     this.avatar = data.avatar || null;

//     // Use optional chaining for nested object properties
//     this.profile = data?.profile ?? null;

//     // Enhanced type conversion
//     this.isBan = !!data?.isBan;
//     this.enabledFlag = data?.enabledFlag ?? true;
//     // this.isBan = data.isBan !== undefined ? Boolean(Number(data.isBan)) : false;
//     // this.enabledFlag =
//     //   data.enabledFlag !== undefined ? Boolean(Number(data.enabledFlag)) : true;
//     // this.role = data.role || "USER";

//     // Enum-like role validation
//     this.role = VALID_ROLES.includes(data?.role) ? data.role : "USER";
//     this.createdBy = data.createdBy ? Number(data.createdBy) : null;
//     this.createdDate = data.createdDate
//       ? new Date(data.createdDate)
//       : new Date();
//     this.lastUpdatedBy = data.lastUpdatedBy ? Number(data.lastUpdatedBy) : null;
//     this.lastUpdatedDatee = data.lastUpdatedDatee
//       ? new Date(data.lastUpdatedDatee)
//       : new Date();
//     this.objectVersionId = data.objectVersionId
//       ? Number(data.objectVersionId)
//       : 1;
//   }

//   // Add a method for password hashing
//   hashPassword(password) {
//     // Consider using a more modern hashing method
//     return bcrypt.hashSync(password, 12); // increased salt rounds
//   }

//   // Optional: Add validation methods
//   validate() {
//     const errors = [];

//     if (!this.username?.trim()) {
//       errors.push("Username is required");
//     }

//     if (
//       this.username &&
//       (this.username.length < 5 || this.username.length > 50)
//     ) {
//       errors.push("Username must be between 5 and 50 characters");
//     }

//     // Advanced email validation
//     const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
//     if (!this.email || !emailRegex.test(this.email)) {
//       errors.push("Invalid email format");
//     }

//     // Password complexity requirements
//     const passwordRegex =
//       /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
//     console.log(this.password);
//     if (!passwordRegex.test(this.password)) {
//       errors.push(
//         "Password must be at least 8 characters, include uppercase, lowercase, number, and special character"
//       );
//     }

//     return {
//       isValid: errors.length === 0,
//       errors,
//     };
//   }

//   // More secure JSON serialization
//   toJSON() {
//     const { password, ...safeUser } = this;
//     return {
//       ...safeUser,
//       createdDate: this.createdDate.toISOString(),
//       lastUpdatedDatee: this.lastUpdatedDatee.toISOString(),
//     };
//   }
// }
