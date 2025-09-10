export type VerifyFunction = (
  profile: OpenIDProfile,
  tokens: OpenIDTokens,
  done: (error?: any, user?: any) => void,
) => void | Promise<void>;
