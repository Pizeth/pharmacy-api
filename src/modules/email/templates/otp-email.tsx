import * as React from 'react';
import {
  Html,
  Head,
  Body,
  Container,
  Text,
  Section,
  Tailwind,
} from 'react-email';

interface OtpEmailProps {
  otp: string;
  type: 'sign-in' | 'email-verification' | 'forget-password' | 'change-email';
}

export const OtpEmailTemplate = ({ otp, type }: OtpEmailProps) => {
  const getTitle = () => {
    switch (type) {
      case 'sign-in':
        return 'Your Login Verification Code';
      case 'email-verification':
        return 'Verify Your Email Address';
      case 'forget-password':
        return 'Password Reset Code';
      case 'change-email':
        return 'Change Your Email Address Code';
      default:
        return 'Your Verification Code';
    }
  };

  return (
    <Html>
      <Head />
      <Tailwind>
        <Body className='bg-gray-100 font-sans my-auto mx-auto'>
          <Container className='border border-solid border-[#eaeaea] rounded my-[40px] mx-auto p-[20px] max-w-[465px] bg-white'>
            <Text className='text-black text-[20px] font-semibold text-center my-4'>
              Razeth
            </Text>
            <Text className='text-black text-[16px] font-semibold text-center'>
              {getTitle()}
            </Text>
            <Text className='text-gray-600 text-[14px] text-center mt-2'>
              Use the single-use verification code below:
            </Text>
            <Section className='text-center my-[24px] bg-gray-50 py-4 rounded border border-dashed border-gray-300'>
              <Text className='text-[32px] font-mono font-bold tracking-[6px] text-black my-0'>
                {otp}
              </Text>
            </Section>
            <Text className='text-[#666666] text-[12px] leading-[20px] text-center'>
              This code will expire shortly. If you did not request this, please
              ignore this email.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default OtpEmailTemplate;
