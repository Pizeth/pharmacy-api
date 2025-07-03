import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import bcrypt from 'bcrypt';

@Injectable()
export class PasswordUtils {
  private readonly logger = new Logger(PasswordUtils.name);
  private readonly salt: number;

  constructor(private readonly config: ConfigService) {
    this.logger.debug(`${this.constructor.name} initialized`);
    this.logger.debug(`ConfigService injected: ${!!config}`);
    this.salt = this.config.get<number>('BCRYPT_ROUNDS', 12);
  }
  // Password hashing method
  // async hash(password: string, salt: number = 12) {
  //   return bcrypt.hash(password, this.getSalt(salt));
  // }

  async hash(password: string, salt: number = this.salt) {
    // const actualSalt = salt || this.config.get<number>('BCRYPT_ROUNDS', 12);
    return bcrypt.hash(password, salt);
  }

  // Password compare method
  compare(password: string, hashedPassword: string) {
    return bcrypt.compareSync(password, hashedPassword);
  }

  check(password: string, repassword: string) {
    return password === repassword;
  }

  // Salt generating method
  getSalt(salt: number = this.salt) {
    return bcrypt.genSaltSync(salt);
  }
}
