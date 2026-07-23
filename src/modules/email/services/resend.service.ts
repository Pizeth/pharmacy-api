// resend.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { render } from '@react-email/render';
import * as React from 'react';
import VerifyEmailTemplate from 'modules/email/templates/verify-email';
import MagicLinkTemplate from '../templates/magic-link';
import OtpEmailTemplate from '../templates/otp-email';
// import { VerifyEmailTemplate } from './templates/verify-email';

@Injectable()
export class ResendService {
  private resend: Resend;
  private readonly logger = new Logger(ResendService.name);

  constructor(private configService: ConfigService) {
    this.resend = new Resend(this.configService.get<string>('RESEND_API_KEY'));
  }

  async sendVerification(
    email: string,
    userName: string,
    url: string,
    _token?: string,
    _metadata?: Record<string, any>,
  ) {
    try {
      const html = await render(
        React.createElement(VerifyEmailTemplate, {
          userName,
          verificationUrl: url,
        }),
      );

      const { data, error } = await this.resend.emails.send({
        from:
          this.configService.get<string>('EMAIL_FROM') ||
          'Auth <security@yourdomain.com>',
        to: [email],
        subject: 'Verify your email address',
        html,
      });

      if (error) {
        this.logger.error(`Resend failed: ${error.message}`);
        return null;
      }
      return data;
    } catch (err) {
      this.logger.error('Unexpected error sending verification email', err);
    }
  }

  async sendVerificationOTP(
    email: string,
    otp: string,
    type: 'sign-in' | 'email-verification' | 'forget-password' | 'change-email',
  ) {
    const subjectMap = {
      'sign-in': 'Your Sign-In Verification Code',
      'email-verification': 'Verify your Email Address',
      'forget-password': 'Reset your Password Code',
      'change-email': 'Change your Email Address Code',
    };
    try {
      const { data, error } = await this.resend.emails.send({
        from:
          this.configService.get<string>('EMAIL_FROM') ||
          'Auth <security@yourdomain.com>',
        to: [email],
        subject: subjectMap[type] || 'Your Verification Code',
        react: React.createElement(OtpEmailTemplate, { otp, type }), // 👈 Pass React node directly!
      });

      if (error) {
        this.logger.error(`Resend OTP failed: ${error.message}`);
        return null;
      }
      return data;
    } catch (err) {
      this.logger.error('Unexpected error sending OTP email', err);
    }
  }

  async sendMagicLink(
    email: string,
    url: string,
    _token: string,
    _metadata?: Record<string, any>,
  ) {
    try {
      const html = await render(
        React.createElement(MagicLinkTemplate, {
          email,
          url,
        }),
      );

      const { data, error } = await this.resend.emails.send({
        from:
          this.configService.get<string>('EMAIL_FROM') ||
          'Auth <security@yourdomain.com>',
        to: [email],
        subject: 'Magic Link',
        html,
      });

      if (error) {
        this.logger.error(`Resend failed: ${error.message}`);
        return null;
      }
      return data;
    } catch (err) {
      this.logger.error('Unexpected error sending magic link email', err);
    }
  }
}
