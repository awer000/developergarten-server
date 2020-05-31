import jwt, { SignOptions } from 'jsonwebtoken';
import { getRepository } from 'typeorm';
import User from '../entity/User';
import loadVariables from '../loadVariable';
import { Request, Response, RequestHandler } from 'express';

const { SECRET_KEY } = process.env;

if (!SECRET_KEY && process.env.NODE_ENV === 'development') {
  const error = new Error('InvalidSecretKeyError');
  error.message = 'Secret key for JWT is missing.';
  if (process.env.npm_lifecycle_event !== 'typeorm') throw error;
}

export const generateToken = async (payload: any, options?: SignOptions): Promise<string> => {
  const jwtOptions: SignOptions = {
    issuer: 'developergarten.io',
    expiresIn: '7d',
    ...options
  };
  const variables = await loadVariables();
  const secretKey = SECRET_KEY || variables.secretKey;

  if (!jwtOptions.expiresIn) {
    // removes expiresIn when expiresIn is given as undefined
    delete jwtOptions.expiresIn;
  }
  return new Promise((resolve, reject) => {
    if (!secretKey) return;
    jwt.sign(payload, secretKey, jwtOptions, (err, token) => {
      if (err) reject(err);
      resolve(token);
    });
  });
};

export const decodeToken = async <T = any>(token: string): Promise<T> => {
  const variables = await loadVariables();
  const secretKey = SECRET_KEY || variables.secretKey;

  return new Promise((resolve, reject) => {
    if (!secretKey) return;
    jwt.verify(token, secretKey, (err, decoded) => {
      if (err) reject(err);
      resolve(decoded as any);
    });
  });
};

export function setTokenCookie(
  res: Response,
  tokens: { accessToken: string; refreshToken: string }
) {
  // set cookie
  // res.cookie('access_token', tokens.accessToken, {
  //   httpOnly: true,
  //   maxAge: 1000 * 60 * 60,
  //   domain: '.velog.io'
  // });

  // res.cookie('refresh_token', tokens.refreshToken, {
  //   httpOnly: true,
  //   maxAge: 1000 * 60 * 60 * 24 * 30,
  //   domain: '.velog.io'
  // });

  // Following codes are for webpack-dev-server proxy
  res.cookie('access_token', tokens.accessToken, {
    httpOnly: true,
    maxAge: 1000 * 60 * 60
  });

  res.cookie('refresh_token', tokens.refreshToken, {
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 * 30
  });
}

type TokenData = {
  iat: number;
  exp: number;
  sub: string;
  iss: string;
};

type AccessTokenData = {
  user_id: string;
} & TokenData;

type RefreshTokenData = {
  user_id: string;
  token_id: string;
} & TokenData;

export const refresh = async (res: Response, refreshToken: string) => {
  try {
    const decoded = await decodeToken<RefreshTokenData>(refreshToken);
    const user = await getRepository(User).findOne(decoded.user_id);
    if (!user) {
      const error = new Error('InvalidUserError');
      throw error;
    }
    const tokens = await user.refreshUserToken(decoded.token_id, decoded.exp, refreshToken);
    setTokenCookie(res, tokens);
    return decoded.user_id;
  } catch (e) {
    throw e;
  }
};

export const consumeUser: RequestHandler = async (req: Request, res: Response, next) => {
  if (req.path.includes('/auth/logout')) return next(); // ignore when logging out
  let accessToken: string | undefined = ''
  const refreshToken: string | undefined = ''

  const { authorization } = req.headers;

  if (!accessToken && authorization) {
    accessToken = authorization.split(' ')[1];
  }

  try {
    if (!accessToken) {
      throw new Error('NoAccessToken');
    }
    const accessTokenData = await decodeToken<AccessTokenData>(accessToken);
    res.locals.user_id = accessTokenData.user_id;
    // refresh token when life < 30mins
    const diff = accessTokenData.exp * 1000 - new Date().getTime();
    if (diff < 1000 * 60 * 30 && refreshToken) {
      await refresh(res, refreshToken);
    }
  } catch (e) {
    // invalid token! try token refresh...
    if (!refreshToken) return next();
    try {
      const userId = await refresh(res, refreshToken);
      // set user_id if succeeds
      res.locals.user_id = userId;
    } catch (e) { }
  }

  return next();
};
