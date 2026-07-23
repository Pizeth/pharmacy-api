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
} from 'react-email';

interface MagicLinkProps {
  email: string;
  url: string;
}

export const MagicLinkTemplate = ({ email, url }: MagicLinkProps) => {
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
              Hello,
            </Text>
            <Text className='text-black text-[14px] leading-[24px]'>
              Click the button below to log in to your account with a magic
              link:
            </Text>
            <Section className='text-center my-[32px]'>
              <Button
                className='bg-[#000000] rounded text-white text-[12px] font-semibold no-underline text-center px-5 py-3'
                href={url}
              >
                Log In to Razeth
              </Button>
            </Section>
            <Text className='text-[#666666] text-[12px] leading-[24px]'>
              This link is intended for <strong>{email}</strong>. If you did not
              request this email, you can safely ignore it.
            </Text>
            <Text className='text-[#666666] text-[12px] leading-[24px] mt-2'>
              Or copy and paste this URL into your browser: <br />
              <a href={url} className='text-blue-600 break-all'>
                {url}
              </a>
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default MagicLinkTemplate;
