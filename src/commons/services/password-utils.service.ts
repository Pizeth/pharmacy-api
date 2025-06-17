import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import bcrypt from 'bcrypt';

@Injectable()
export class PasswordUtils {
  private logger = new Logger(PasswordUtils.name);

  constructor(private readonly config: ConfigService) {
    this.logger.debug(`${this.constructor.name} initialized`);
    this.logger.debug(`ConfigService injected: ${!!config}`);
  }
  // Password hashing method
  // async hash(password: string, salt: number = 12) {
  //   return bcrypt.hash(password, this.getSalt(salt));
  // }

  async hash(password: string, salt?: number) {
    const actualSalt = salt || this.config.get<number>('SALT', 12);
    return bcrypt.hash(password, actualSalt);
  }

  // Password compare method
  compare(password: string, userPassword: string) {
    return bcrypt.compareSync(password, userPassword);
  }

  check(password: string, repassword: string) {
    return password === repassword;
  }

  // Salt generating method
  getSalt(salt: number) {
    return bcrypt.genSaltSync(!salt ? this.config.get<number>('SALT') : salt);
  }
}
