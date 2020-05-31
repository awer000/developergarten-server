export type SocialProvider = 'github';

const { GITHUB_ID, API_HOST } = process.env;

const redirectPath = `/api/auth/social/callback/`;
export const redirectUri =
  process.env.NODE_ENV === 'development'
    ? `http://localhost:4000${redirectPath}`
    : `https://${API_HOST}${redirectPath}`;

export function generateSocialLoginLink(provider: SocialProvider, next: string = '/') {
  const generators = {
    github(next: string) {
      const redirectUriWithNext = `${redirectUri}github?next=${next}`;
      return `https://github.com/login/oauth/authorize?scope=user:email&client_id=${GITHUB_ID}&redirect_uri=${redirectUriWithNext}`;
    },
  };

  const generator = generators[provider];
  return generator(encodeURI(next));
}

export type SocialProfile = {
  uid: number | string;
  thumbnail: string | null;
  email: string | null;
  name: string;
  username?: string;
};
