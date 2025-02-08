import express from 'express';
import { validateToken } from '../auth/tokenValidation.js';
import {
  signUp,
  login,
  loggedInUser,
  validateReferralCode,
  awardReferralBonus,
  // refreshToken,
  changePassword,
  verifyEmail,
  resendOTP,
  forgotPasswordRequest,
  forgotPassword,
  generateTOTP,
  verifyTOTP,
  resetTOTP,
  enable2FA,
  checkUserName,
  VerifyTokenController,
  GoogleSignIn,
  //   loggedInUser,
  //   sendReset,
  //   resetPassword,
  //   addDeviceId,
} from '../controller/authController.js';
import { createRateLimiter } from '../middleware/rateLimit.js';
import { OAuth2Client } from 'google-auth-library';
import axios from 'axios';

const authRoutes = express.Router();

authRoutes.get('/check-username/:username', createRateLimiter(3 * 60 * 1000, 20, 'Too many requests, please try again after 3 minutes.'), checkUserName);
authRoutes.post('/signup', createRateLimiter(10 * 60 * 1000, 5, 'Too many requests, please try again after 10 minutes.'), signUp);
authRoutes.post('/validateRefferalCode', validateReferralCode);
authRoutes.post('/awardReferralBonus', awardReferralBonus);
authRoutes.post('/login', login);
// authRoutes.post("/refreshToken", refreshToken);
authRoutes.put("/change-password", validateToken, createRateLimiter(15 * 60 * 1000, 3, 'Too many password change attempts, please try again after 15 minutes.'), changePassword)
authRoutes.get("/get-userInfo", validateToken, createRateLimiter(5 * 60 * 1000, 60, 'Too many requests, please try again after 5 minutes.'), loggedInUser)
authRoutes.post("/verifyEmail", validateToken, createRateLimiter(10 * 60 * 1000, 5, 'Too many verification attempts, please try again after 10 minutes.'), verifyEmail)
authRoutes.post("/resendOtp", validateToken, createRateLimiter(10 * 60 * 1000, 3, 'Too many OTP requests, please try again after 10 minutes.'), resendOTP)
authRoutes.post("/forgotPasswordRequest", createRateLimiter(15 * 60 * 1000, 3, 'Too many password reset requests, please try again after 15 minutes.'), forgotPasswordRequest)
authRoutes.post("/forgotPassword", createRateLimiter(15 * 60 * 1000, 5, 'Too many password reset attempts, please try again after 15 minutes.'), forgotPassword)
// authRoutes.put("/usersetting", validateToken, changePassword)

// authRoutes.post("/request-reset" , sendReset)
// authRoutes.post("/reset-password/:id/:token" , resetPassword)
// authRoutes.post("/addDeviceId" , validateToken, addDeviceId)

authRoutes.post("/generate-totp", validateToken, createRateLimiter(10 * 60 * 1000, 3, 'Too many TOTP generation attempts, please try again after 10 minutes.'), generateTOTP)
authRoutes.post("/verify-totp", validateToken, createRateLimiter(5 * 60 * 1000, 5, 'Too many verification attempts, please try again after 5 minutes.'), verifyTOTP)
authRoutes.post("/reset-totp", validateToken, createRateLimiter(15 * 60 * 1000, 2, 'Too many TOTP reset attempts, please try again after 15 minutes.'), resetTOTP)
authRoutes.put("/enable-2fa", validateToken, createRateLimiter(30 * 60 * 1000, 2, 'Too many 2FA enable attempts, please try again after 30 minutes.'),
  enable2FA)

// API endpoint to verify and decode token
authRoutes.get('/verify-token', validateToken, VerifyTokenController);
// Google Sign-In route
authRoutes.post('/google-signin', GoogleSignIn);



export default authRoutes;
