import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import User from '../models/User.model';
import OAuthProvider from '../models/OAuthProvider.model';
import logger from '../utils/logger';

export const setupPassport = () => {
  // Google OAuth Strategy
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/v1/auth/google/callback',
        },
        async (accessToken, refreshToken, profile, done) => {
          try {
            // Check if OAuth provider exists
            let oauthProvider = await OAuthProvider.findOne({
              where: {
                provider: 'GOOGLE',
                providerId: profile.id,
              },
              include: [{ model: User, as: 'user' }],
            });

            if (oauthProvider) {
              // Update tokens
              oauthProvider.accessToken = accessToken;
              oauthProvider.refreshToken = refreshToken;
              oauthProvider.profile = profile._json;
              await oauthProvider.save();

              return done(null, oauthProvider);
            }

            // Check if user exists with email
            const email = profile.emails?.[0]?.value;
            if (!email) {
              return done(new Error('No email provided by Google'), false);
            }

            let user = await User.findOne({ where: { email } });

            if (!user) {
              // Create new user
              user = await User.create({
                email,
                username: profile.emails[0].value.split('@')[0] + '_' + Math.random().toString(36).substring(7),
                fullName: profile.displayName,
                role: 'USER',
                isEmailVerified: true, // Email verified by Google
              });
            }

            // Create OAuth provider link
            oauthProvider = await OAuthProvider.create({
              userId: user.id,
              provider: 'GOOGLE',
              providerId: profile.id,
              accessToken,
              refreshToken,
              profile: profile._json,
            });

            return done(null, oauthProvider);
          } catch (error) {
            logger.error('Google OAuth error:', error);
            return done(error, false);
          }
        }
      )
    );
  }

  // Facebook OAuth Strategy
  if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
    passport.use(
      new FacebookStrategy(
        {
          clientID: process.env.FACEBOOK_APP_ID,
          clientSecret: process.env.FACEBOOK_APP_SECRET,
          callbackURL: process.env.FACEBOOK_CALLBACK_URL || 'http://localhost:3000/api/v1/auth/facebook/callback',
          profileFields: ['id', 'emails', 'name', 'picture.type(large)'],
        },
        async (accessToken, refreshToken, profile, done) => {
          try {
            let oauthProvider = await OAuthProvider.findOne({
              where: {
                provider: 'FACEBOOK',
                providerId: profile.id,
              },
              include: [{ model: User, as: 'user' }],
            });

            if (oauthProvider) {
              oauthProvider.accessToken = accessToken;
              oauthProvider.refreshToken = refreshToken;
              oauthProvider.profile = profile._json;
              await oauthProvider.save();

              return done(null, oauthProvider);
            }

            const email = profile.emails?.[0]?.value;
            if (!email) {
              return done(new Error('No email provided by Facebook'), false);
            }

            let user = await User.findOne({ where: { email } });

            if (!user) {
              user = await User.create({
                email,
                username: profile.emails[0].value.split('@')[0] + '_' + Math.random().toString(36).substring(7),
                fullName: `${profile.name?.givenName} ${profile.name?.familyName}`,
                role: 'USER',
                isEmailVerified: true,
              });
            }

            oauthProvider = await OAuthProvider.create({
              userId: user.id,
              provider: 'FACEBOOK',
              providerId: profile.id,
              accessToken,
              refreshToken,
              profile: profile._json,
            });

            return done(null, oauthProvider);
          } catch (error) {
            logger.error('Facebook OAuth error:', error);
            return done(error, false);
          }
        }
      )
    );
  }

  // Microsoft OAuth would go here similarly
  // passport.use(new MicrosoftStrategy(...))
};

