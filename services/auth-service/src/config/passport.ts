import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import User from '../models/User.model';
import OAuthProvider from '../models/OAuthProvider.model';
import logger from '../utils/logger';

// Helper function to generate unique username from email
// Ensures username is between 3-20 characters
const generateUsernameFromEmail = async (email: string): Promise<string> => {
  const emailPrefix = email.split('@')[0];
  const maxPrefixLength = 12; // Reserve space for underscore and random suffix
  
  // Truncate email prefix if too long
  let baseUsername = emailPrefix.substring(0, maxPrefixLength);
  
  // Generate unique suffix (6 characters)
  const randomSuffix = Math.random().toString(36).substring(2, 8); // 6 chars
  
  let username = `${baseUsername}_${randomSuffix}`;
  
  // Ensure total length is <= 20
  if (username.length > 20) {
    const availableLength = 20 - randomSuffix.length - 1; // -1 for underscore
    baseUsername = emailPrefix.substring(0, availableLength);
    username = `${baseUsername}_${randomSuffix}`;
  }
  
  // Check if username already exists, if so, try with different suffix
  let attempts = 0;
  while (attempts < 10) {
    const existingUser = await User.findOne({ where: { username } });
    if (!existingUser) {
      return username;
    }
    // Try with different suffix
    const newSuffix = Math.random().toString(36).substring(2, 8);
    const availableLength = 20 - newSuffix.length - 1;
    baseUsername = emailPrefix.substring(0, availableLength);
    username = `${baseUsername}_${newSuffix}`;
    attempts++;
  }
  
  // Fallback: use timestamp if all attempts fail
  const timestamp = Date.now().toString(36).substring(0, 6);
  const availableLength = 20 - timestamp.length - 1;
  baseUsername = emailPrefix.substring(0, availableLength);
  return `${baseUsername}_${timestamp}`;
};

export const setupPassport = () => {
  // Log OAuth configuration status
  logger.info('🔐 Configuring OAuth strategies...');
  
  // Google OAuth Strategy
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    logger.info('✅ Google OAuth configured');
    passport.use(
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3001/api/auth/google/callback',
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

              return done(null, { userId: oauthProvider.userId });
            }

            // Check if user exists with email
            const email = profile.emails?.[0]?.value;
            if (!email) {
              return done(new Error('No email provided by Google'), false);
            }

            let user = await User.findOne({ where: { email } });

            if (!user) {
              // Generate unique username
              const username = await generateUsernameFromEmail(email);
              
              // Create new user
              user = await User.create({
                email,
                username,
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

            return done(null, { userId: user.id });
          } catch (error) {
            logger.error('Google OAuth error:', error);
            return done(error, false);
          }
        }
      )
    );
  } else {
    logger.warn('⚠️  Google OAuth not configured - using demo mode');
  }

  // Facebook OAuth Strategy
  if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
    logger.info('✅ Facebook OAuth configured');
    passport.use(
      new FacebookStrategy(
        {
          clientID: process.env.FACEBOOK_APP_ID,
          clientSecret: process.env.FACEBOOK_APP_SECRET,
          callbackURL: process.env.FACEBOOK_CALLBACK_URL || 'http://localhost:3001/api/auth/facebook/callback',
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

              return done(null, { userId: oauthProvider.userId });
            }

            const email = profile.emails?.[0]?.value;
            if (!email) {
              return done(new Error('No email provided by Facebook'), false);
            }

            let user = await User.findOne({ where: { email } });

            if (!user) {
              // Generate unique username
              const username = await generateUsernameFromEmail(email);
              
              user = await User.create({
                email,
                username,
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

            return done(null, { userId: user.id });
          } catch (error) {
            logger.error('Facebook OAuth error:', error);
            return done(error, false);
          }
        }
      )
    );
  } else {
    logger.warn('⚠️  Facebook OAuth not configured - using demo mode');
  }

  // Log final status
  logger.info('✅ Passport configuration complete');
};