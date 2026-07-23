import * as React from 'react';
import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Button,
  Tailwind,
} from 'react-email'; // 👈 Exported directly from 'react-email'

interface VerifyEmailProps {
  userName?: string;
  verificationUrl: string;
}

export const VerifyEmailTemplate = ({
  userName = 'User',
  verificationUrl,
}: VerifyEmailProps) => {
  return (
    <Html>
      <Head />
      <Tailwind>
        <Body className='bg-gray-100 font-sans my-auto mx-auto'>
          <Container className='border border-solid border-[#eaeaea] rounded my-[40px] mx-auto p-[20px] max-w-[465px] bg-white'>
            <Text className='text-black text-[20px] font-semibold text-center my-4'>
              Razeth
            </Text>
            <Text className='text-black text-[14px] leading-[24px]'>
              Hello {userName},
            </Text>
            <Text className='text-black text-[14px] leading-[24px]'>
              Please verify your email address to activate your account and
              complete registration.
            </Text>
            <Section className='text-center my-[32px]'>
              <Button
                className='bg-[#000000] rounded text-white text-[12px] font-semibold no-underline text-center px-5 py-3'
                href={verificationUrl}
              >
                Verify Email
              </Button>
            </Section>
            <Text className='text-[#666666] text-[12px] leading-[24px]'>
              Or copy and paste this link into your browser: <br />
              <a href={verificationUrl} className='text-blue-600 break-all'>
                {verificationUrl}
              </a>
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default VerifyEmailTemplate;
