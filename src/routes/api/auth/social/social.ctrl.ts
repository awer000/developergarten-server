import { getRepository } from 'typeorm';
import SocialAccount from '../../../../entity/SocialAccount';
import { RequestHandler } from 'express';
import { generateToken, decodeToken, setTokenCookie } from '../../../../lib/token';
import { getGithubAccessToken, getGithubProfile } from '../../../../lib/social/github';
import User from '../../../../entity/User';
import {
  SocialProvider,
  generateSocialLoginLink,
  SocialProfile,
  redirectUri
} from '../../../../lib/social';
import Joi from 'joi';
import { validateBody } from '../../../../lib/utils';
import UserProfile from '../../../../entity/UserProfile';
import UserMeta from '../../../../entity/UserMeta';
// import downloadFile from '../../../../../lib/downloadFile';
// import UserImage from '../../../../../entity/UserImage';
// import { generateUploadPath } from '../../files';
// import AWS from 'aws-sdk';
// import { getFacebookAccessToken, getFacebookProfile } from '../../../../../lib/social/facebook';
// import { getGoogleAccessToken, getGoogleProfile } from '../../../../../lib/social/google';

// const s3 = new AWS.S3({
//   region: 'ap-northeast-2',
//   signatureVersion: 'v4'
// });

const {
  GITHUB_ID,
  GITHUB_SECRET,
  CLIENT_HOST
} = process.env;

if (!GITHUB_ID || !GITHUB_SECRET) {
  throw new Error('GITHUB ENVVAR IS MISSING');
}

type SocialRegisterToken = {
  profile: SocialProfile;
  provider: SocialProvider;
  accessToken: string;
};

async function getSocialAccount(params: { uid: number | string; provider: SocialProvider }) {
  const socialAccountRepo = getRepository(SocialAccount);
  const socialAccount = await socialAccountRepo.findOne({
    where: {
      social_id: params.uid.toString(),
      provider: params.provider
    }
  });
  return socialAccount;
}
// test
// async function syncProfileImage(url: string, user: User) {
//   const result = await downloadFile(url);
//   // create userImage
//   const userImageRepo = getRepository(UserImage);
//   const userImage = new UserImage();
//   userImage.fk_user_id = user.id;
//   userImage.type = 'profile';
//   await userImageRepo.save(userImage);

//   // generate s3 path
//   const uploadPath = generateUploadPath({
//     id: userImage.id,
//     username: user.username,
//     type: 'profile'
//   });
//   const key = `${uploadPath}/social.${result.extension}`;

//   // upload
//   await s3
//     .upload({
//       Bucket: 's3.images.velog.io',
//       Key: key,
//       Body: result.stream,
//       ContentType: result.contentType
//     })
//     .promise();

//   result.cleanup();

//   return `https://images.velog.io/${key}`;
// }

/**
 * Social Register
 * POST /api/v2/auth/social/register
 * {
 *   form: {
 *     display_name,
 *     username,
 *     short_bio
 *   }
 * }
 */
export const socialRegister: RequestHandler = async (req, res) => {
  // check token existancy
  const registerToken = req.cookies['register_token'];
  if (!registerToken) {
    res.status(401);
    return;
  }

  // check postbody schema
  const schema = Joi.object().keys({
    display_name: Joi.string()
      .min(1)
      .max(45)
      .required(),
    username: Joi.string()
      .regex(/^[a-z0-9-_]+$/)
      .min(3)
      .max(16)
      .required(),
    short_bio: Joi.string()
      .allow('')
      .max(140)
  });

  if (!validateBody(req, res, schema)) return;
  type RequestBody = {
    display_name: string;
    username: string;
    short_bio: string;
  };
  const { display_name, username, short_bio }: RequestBody = req.body;
  let decoded: SocialRegisterToken | null = null;
  try {
    decoded = await decodeToken<SocialRegisterToken>(registerToken);
  } catch (e) {
    // failed to decode token
    res.status(401);
    return;
  }
  const email = decoded.profile.email;

  try {
    const userRepo = getRepository(User);
    // check duplicates
    const exists = await userRepo
      .createQueryBuilder()
      .where('username = :username', { username })
      .orWhere('email = :email AND email != null', { email })
      .getOne();

    if (exists) {
      res.status(409);
      res.json({
        name: 'ALREADY_EXISTS',
        payload: email === exists.email ? 'email' : 'username'
      });
      return;
    }

    const userProfileRepo = getRepository(UserProfile);
    const userMetaRepo = getRepository(UserMeta);

    // create user
    const user = new User();
    user.email = email;
    user.is_certified = true;
    user.username = username;
    await userRepo.save(user);

    // create social account
    const socialAccount = new SocialAccount();
    socialAccount.access_token = decoded.accessToken;
    socialAccount.provider = decoded.provider;
    socialAccount.fk_user_id = user.id;
    socialAccount.social_id = decoded.profile.uid.toString();

    const socialAccountRepo = getRepository(SocialAccount);
    await socialAccountRepo.save(socialAccount);

    // create profile
    const profile = new UserProfile();
    profile.fk_user_id = user.id;
    profile.display_name = display_name;
    profile.short_bio = short_bio;

    if (decoded.profile.thumbnail) {
      try {
        // const imageUrl = await syncProfileImage(decoded.profile.thumbnail, user);
        profile.thumbnail = 'https://upload.wikimedia.org/wikipedia/commons/8/84/Irene_Bae_at_Asia_Artist_Awards_on_November_26%2C_2019_02.jpg';
      } catch (e) { }
    }

    await userProfileRepo.save(profile);

    const userMeta = new UserMeta();
    userMeta.fk_user_id = user.id;

    await Promise.all([userMetaRepo.save(userMeta)]);

    const tokens = await user.generateUserToken();
    setTokenCookie(res, tokens);
    res.json({
      ...user,
      profile,
      tokens: {
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken
      }
    });
    // create token
    // set token
    // return data
  } catch (e) {
    console.error(e)
  }
};

// /**
//  * /api/v2/auth/social/callback/github
//  */
export const githubCallback: RequestHandler = async (req, res, next) => {
  const { code }: { code?: string } = req.query;
  if (!code) {
    res.status(400);
    return;
  }
  try {
    const accessToken = await getGithubAccessToken({
      code,
      clientId: GITHUB_ID,
      clientSecret: GITHUB_SECRET
    });
    const profile = await getGithubProfile(accessToken);

    const socialAccount = await getSocialAccount({
      uid: profile.uid,
      provider: 'github'
    });

    res.locals.profile = profile;
    res.locals.socialAccount = socialAccount;
    res.locals.accessToken = accessToken;
    res.locals.provider = 'github';
    return next();
  } catch (e) {
    console.error(e)
  }
};

export const socialCallback: RequestHandler = async (req, res) => {
  try {
    const { profile, socialAccount, accessToken, provider } = res.locals as {
      profile: SocialProfile;
      socialAccount: SocialAccount | undefined;
      accessToken: string;
      provider: SocialProvider;
    };

    if (!profile || !accessToken) return;
    // SocialAccount already exists in db
    const userRepo = getRepository(User);
    if (socialAccount) {
      // login process
      const user = await userRepo.findOne(socialAccount.fk_user_id);
      if (!user) {
        throw new Error('User is missing');
      }
      const tokens = await user.generateUserToken();
      setTokenCookie(res, tokens);
      const redirectUrl =
        process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : `https://${CLIENT_HOST}`;


      const state = req.query.state ? (JSON.parse(req.query.state as string) as { next: string }) : null;
      const next = req.query.next || state?.next || '/';

      res.redirect(encodeURI(redirectUrl.concat(next as string)));
      return;
    }


    // Find by email ONLY when email exists
    let user: User | undefined = undefined;
    if (profile.email) {
      user = await userRepo.findOne({
        email: profile.email
      });
    }

    // Email exists -> Login
    if (user) {
      const tokens = await user.generateUserToken();
      setTokenCookie(res, tokens);
      const redirectUrl =
        process.env.NODE_ENV === 'development' ? 'https://localhost:3000/' : 'https://velog.io/';
      res.redirect(encodeURI(redirectUrl));
      return;
    }

    // Register new social account
    const registerTokenInfo = {
      profile,
      accessToken,
      provider
    };

    const registerToken = await generateToken(registerTokenInfo, {
      expiresIn: '1h'
    });

    // set register token to cookie
    res.cookie('register_token', registerToken, {
      maxAge: 1000 * 60 * 60,
    })

    const redirectUrl =
      process.env.NODE_ENV === 'development'
        ? 'http://localhost:3000/register?social=1'
        : 'https://velog.io/register?social=1';
    res.redirect(encodeURI(redirectUrl));
  } catch (e) {
    console.error(e)
    // ctx.throw(500, e);
  }
};
export const getSocialProfile: RequestHandler = async (req, res) => {
  const registerToken = req.cookies.get('register_token');
  if (!registerToken) {
    res.status(401);
    return;
  }
  try {
    const decoded = await decodeToken(registerToken);
    res.json(decoded.profile);
  } catch (e) {
    res.status(400);
    return;
  }
};

// /**
//  * Redirect to Social Login Link
//  *
//  * GET /api/v2/auth/social/redirect/:provider(facebook|google|github)
//  */
export const socialRedirect: RequestHandler = async (req, res) => {
  const { provider } = req.params as any;
  const { next } = req.query as any;
  const validated = ['github'].includes(provider);
  if (!validated) {
    res.status(400)
    return;
  }

  const loginUrl = generateSocialLoginLink(provider, next);
  res.redirect(loginUrl);
};
