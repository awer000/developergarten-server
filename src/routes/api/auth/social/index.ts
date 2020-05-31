import express from 'express';
import {
  githubCallback,
  socialRedirect,
  // getSocialProfile,
  socialRegister,
  socialCallback,
} from './social.ctrl';

const social = express.Router();

/* LOGIN & REGISTER */
// social.post('/verify-social/:provider', async ctx => {});
social.post('/register', socialRegister);
// social.post('/login/:provider', async ctx => {});

// /* Callback */
social.get('/callback/github', githubCallback, socialCallback);
// social.get('/callback/google', googleCallback, socialCallback);
// social.get('/callback/facebook', facebookCallback, socialCallback);

// /* Login Token */
// social.get('/profile', getSocialProfile);
social.get('/redirect/:provider', socialRedirect);

export default social;
