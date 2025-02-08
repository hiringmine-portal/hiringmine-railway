import nodemailer from "nodemailer";
import { hashSync, genSaltSync, compareSync } from 'bcrypt';
import { sendError, sendSuccess } from '../utils/responses.js';
import {
  ALREADYEXISTS,
  BADREQUEST,
  CREATED,
  EMAILNOTVERIFIED,
  FORBIDDEN,
  INTERNALERROR,
  NOTFOUND,
  OK,
  UNAUTHORIZED,
} from '../constants/httpStatus.js';
import Users from '../models/Register.js';
import { PENDING } from '../constants/constants.js';
import { v4 as uuidv4 } from 'uuid';
import {
  responseMessages,
  // GET_SUCCESS_MESSAGES,
  // INVITATION_LINK_UNSUCCESS,
  // MISSING_FIELDS,
  // MISSING_FIELD_EMAIL,
  // NO_USER,
  // NO_USER_FOUND,
  // PASSWORD_AND_CONFIRM_NO_MATCH,
  // PASSWORD_CHANGE,
  // PASSWORD_FAILED,
  // RESET_LINK_SUCCESS,
  // SUCCESS_REGISTRATION,
  // UN_AUTHORIZED,
  // USER_EXISTS,
  // USER_NAME_EXISTS,
} from '../constants/responseMessages.js';
import { GenerateToken, ValidateToken, VerifyToken } from '../helpers/token.js';
import pkg from 'jsonwebtoken';
import PointsSchema from '../models/PointsSchema.js';
import { awardPoints, checkIfUserExists } from '../helpers/genericFunctions.js';
import { config } from '../config/default.js';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import TOTP from "../models/totp.js";
import { signupTemplate } from "../templates/signup.js";
import { redis } from "../app.js";
import { scanAndDelete } from "../utils/index.js";
import axios from "axios";

const { verify, decode } = pkg;

const {
  GET_SUCCESS_MESSAGES,
  INVITATION_LINK_UNSUCCESS,
  MISSING_FIELDS,
  MISSING_FIELD_EMAIL,
  NO_USER,
  NO_USER_FOUND,
  PASSWORD_AND_CONFIRM_NO_MATCH,
  PASSWORD_CHANGE,
  PASSWORD_FAILED,
  RESET_LINK_SUCCESS,
  SUCCESS_REGISTRATION,
  UN_AUTHORIZED,
  USER_EXISTS,
  USER_NAME_EXISTS,
  OLD_PASSWORD_NOT_MATCH
} = responseMessages;


const createReferralCode = async () => {
  let referralCode = uuidv4().slice(0, 8);
  const checkReferralCode = async () => {
    const user = await checkIfUserExists('referralCode', referralCode);
    if (user) {
      referralCode = uuidv4().slice(0, 8);
      await checkReferralCode();
    } else {
      // return referralCode;
    }
  };

  await checkReferralCode();
  return referralCode;
};

const emailConfig = {
  service: "gmail",
  auth: {
    user: process.env.PORTAL_EMAIL,
    pass: process.env.PORTAL_PASSWORD,
  },
};

// Function to send OTP or Reset Password Link via email
async function sendEmail(mail, otpOrPasswordReset, reason, token) {
  const transporter = nodemailer.createTransport(emailConfig);

  if (reason == 'otp') {
    const mailOptions = {
      from: process.env.PORTAL_EMAIL,
      to: mail,
      subject: "OTP Verification",
      // text: `Your OTP is: ${otpOrPasswordReset}`,
      html: signupTemplate(otpOrPasswordReset, token),
    };

    try {
      await transporter.sendMail(mailOptions);
      return `OTP sent to ${mail} via email`;
    } catch (error) {
      throw `Error sending OTP to ${mail} via email: ${error}`;
    }
  } else {
    const mailOptions = {
      from: process.env.PORTAL_EMAIL,
      to: mail,
      subject: "Forgot Password URL",
      text: `To reset your password, click on the following link: ${otpOrPasswordReset}`,
    };

    try {
      await transporter.sendMail(mailOptions);
      return `Reset Password URL sent to ${mail} via email`;
    } catch (error) {
      throw `Error sending Reset Password URL to ${mail} via email: ${error}`;
    }
  }


}


// @desc    SIGNUP
// @route   POST api/auth/signup
// @access  Public



export const signUp = async (req, res) => {
  try {
    const { firstName, lastName, userName, email, password, cPassword, referralCode } =
      req.body;

    await redis.del(`/api/auth/check-username/${userName}$${process.env.CACHE_KEY}`);
    if (!firstName || !lastName || !userName || !email || !password || !cPassword) {
      return res
        .status(BADREQUEST)
        .send(sendError({ status: false, message: MISSING_FIELDS }));
    }

    let user;

    const cacheKey = req.originalUrl + "emailExists" + email;
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      user = JSON.parse(cachedData);
    } else {
      user = await Users.findOne({ email: email });
      redis.setex(cacheKey, process.env.REDIS_SECONDS, JSON.stringify(user));
    }

    if (user) {
      return res
        .status(ALREADYEXISTS)
        .send(sendError({ status: false, message: USER_EXISTS }));
    } else {
      const user = await Users.findOne({ userName: userName.toLowerCase().trim() });
      if (user) {
        return res
          .status(ALREADYEXISTS)
          .send(sendError({ status: false, message: USER_NAME_EXISTS }));
      } else {
        // Call the function with the desired pattern
        // await scanAndDelete('/api/users?limit=10&pageNo=*&keyWord=*&category=*versionDev');
        const salt = genSaltSync(10);
        let doc;

        if (password?.length > 7) {
          doc = new Users({
            firstName,
            lastName,
            email,
            password: hashSync(password, salt),
            userName: userName.toLowerCase().trim(),
            totalPoints: 100, // Initial points for registration
          });

          // Generate referral code and associate with the user
          doc.referralCode = await createReferralCode();
          const otp = uuidv4().slice(0, 6);

          doc.otp = otp;
          doc.otpExpires = Date.now() + 600000; // OTP expires in 10 minutes
          doc.isVerified = false

          let savedUser = await doc.save();
          // Save the 100 points in the Points collection
          const points = new PointsSchema({
            user: savedUser._id,
            points: 100,
            earnedAt: Date.now(),
            reason: 'Registration Bonus',
            category: 'Bonus',
          });
          let savedPoints = await points.save();

          if (savedUser.errors || savedPoints.errors) {
            return res
              .status(INTERNALERROR)
              .send(sendError({ status: false, message: error.message, error }));
          } else {
            savedUser.password = undefined; // Don't send password in response
            savedUser.otp = undefined; // Don't send OTP in response
            savedUser.otpExpires = undefined; // Don't send OTP expiry in response

            const token = GenerateToken({ data: savedUser, expiresIn: '24h' });

            // Send OTP via email
            const emailResponse = await sendEmail(email, otp, 'otp', token);
            console.log(emailResponse);

            return res.status(CREATED).send(
              sendSuccess({
                status: true,
                message: SUCCESS_REGISTRATION,
                token,
                data: savedUser,
              })
            );
          }
        } else {
          return res
            .status(FORBIDDEN)
            .send(sendError({ status: false, message: UN_AUTHORIZED }));
        }
      }
    }
  } catch (error) {
    return res
      .status(INTERNALERROR)
      .send(sendError({ status: false, message: error.message, error }));
  }
};

// @desc    RESEND OTP
// @route   POST api/auth/resendOTP
// @access  Private

export const resendOTP = async (req, res) => {
  const { type } = req.query;
  try {
    if (req.user.email) {
      const user = await Users.findOne({ email: req.user.email });
      if (user) {
        if (type === 'password') {
        } else {

          const otp = uuidv4().slice(0, 6);
          user.otp = otp;
          user.otpExpires = Date.now() + 600000; // OTP expires in 10 minutes
          await user.save();
          // Send OTP via email

          const token = GenerateToken({ data: user, expiresIn: '24h' });
          const emailResponse = await sendEmail(req.user.email, otp, 'otp', token);
          console.log(emailResponse);
          return res.status(CREATED).send(
            sendSuccess({
              status: true,
              message: "OTP sent successfully",
            })
          );
        }
      } else {
        return res
          .status(NOTFOUND)
          .send(sendError({ status: false, message: NO_USER }));
      }
    } else {
      return res
        .status(BADREQUEST)
        .send(sendError({ status: false, message: MISSING_FIELDS }));
    }
  } catch (error) {
    return res
      .status(INTERNALERROR)
      .send(sendError({ status: false, message: error.message, error }));
  }
};


// @desc    VERIFY EMAIL
// @route   POST api/auth/verifyEmail
// @access  Private

export const verifyEmail = async (req, res) => {
  try {
    const { otp } = req.body;
    if (otp) {
      const user = await Users.findOne({ otp: otp, _id: req.user._id });
      console.log("user", user)
      console.log("req.user._id", req.user._id)
      if (user) {
        if (user.otpExpires > Date.now()) {
          user.isVerified = true;
          user.otp = undefined;
          user.otpExpires = undefined;
          await user.save();
          return res.status(OK).send(
            sendSuccess({
              status: true,
              message: 'Email Verified Successfully',
              data: user,
            })
          );
        } else {
          return res.status(OK).send(
            sendError({
              status: false,
              message: 'OTP has expired. Please request a new OTP',
            })
          );
        }
      } else {
        return res
          .status(FORBIDDEN)
          .send(sendError({ status: false, message: 'Invalid OTP' }));
      }
    } else {
      return res
        .status(BADREQUEST)
        .send(sendError({ status: false, message: MISSING_FIELDS }));
    }
  } catch (error) {
    return res
      .status(INTERNALERROR)
      .send(sendError({ status: false, message: error.message, error }));
  }
};


// @desc    VALIDATE REFERRAL CODE
// @route   GET api/auth/validateRefferalCode
// @access  Public

// Referral Code Validation API
export const validateReferralCode = async (req, res) => {
  try {
    // Extract the referral code from the request body or query parameters
    const referralCode = req.body.referralCode;

    // Perform validation logic to check if the referral code is valid
    // Query the database to find the user associated with the referral code
    const referringUser = await Users.findOne({ referralCode });

    if (!referringUser) {
      return res.status(404).json(sendError({ msg: 'Invalid referral code' }));
    }

    // If the referral code is valid, return the details of the referring user
    return res.status(CREATED).send(
      sendSuccess({
        status: true,
        message: "Referral code is valid",
        data: referringUser
      })
    );
  } catch (error) {
    console.error(error);
    return res.status(500).send('Server Error');
  }
};

// @desc    AWARD REFERRAL BONUS
// @route   GET api/auth/awardReferralBonus
// @access  Public

// Referral Bonus Awarding API
export const awardReferralBonus = async (req, res) => {
  try {
    // Extract user IDs of the referring user and the newly registered user from the request
    const { referringUserId, newlyRegisteredUserId } = req.body;

    // Award bonus points to the referring user
    await awardPoints(referringUserId, 500, 'Referral Bonus', 'Bonus');

    // Award bonus points to the newly registered user
    await awardPoints(newlyRegisteredUserId, 500, 'Referral Bonus', 'Bonus', referringUserId);

    // Return success response
    return res.status(200).json(sendSuccess({ msg: 'Referral bonus awarded successfully' }));
  } catch (error) {
    console.error(error);
    return res.status(500).send('Server Error');
  }
};

// @desc    LOGIN
// @route   POST api/auth/login
// @access  Public

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (email && password) {
      let user = await Users.findOne({ email: email });
      if (user) {
        if (!user.isVerified) {
          return res
            .status(EMAILNOTVERIFIED)
            .send(sendError({ status: false, message: "Please verify your email" }));
        }
        const isValid = compareSync(password, user.password);
        if (user.email === email && isValid) {
          user.password = undefined;
          // const token = GenerateToken({ data: user, expiresIn: '24h' });
          // Create token with only essential information
          const token = GenerateToken({
            data: {
              _id: user._id,            // User ID
              email: user.email,       // Optional, based on your needs
              role: user.role          // Optional, only if role is necessary
            },
            expiresIn: '24h'
          });
          const enable2FA = user.enable2FA
          res.status(OK).send(
            sendSuccess({
              status: true,
              message: 'Login Successful',
              token,
              data: enable2FA ? { enable2FA, isVerified: user?.isVerified } : user,
              // data: user,
            })
          );
        } else {
          return res
            .status(BADREQUEST)
            .send(sendError({ status: false, message: UN_AUTHORIZED }));
        }
      } else {
        return res
          .status(NOTFOUND)
          .send(sendError({ status: false, message: NO_USER }));
      }
    } else {
      return res
        .status(BADREQUEST)
        .send(sendError({ status: false, message: MISSING_FIELDS }));
    }
  } catch (error) {
    return res.status(INTERNALERROR).send(
      sendError({
        status: false,
        message: error.message,
        data: null,
      })
    );
  }
};

// @desc    RefreshToken
// @route   GET api/auth/refreshToken
// @access  Public

// export const refreshToken = async (req, res) => {
//   try {
//     const { token } = req.body;
//     if (token) {
//       // Decode Token
//       const { result } = decode(token);
//       let user = result;
//       if (user) {
//         if (!user.IsActivate) {
//           return res.status(OK).send(
//             sendSuccess({
//               status: true,
//               message:
//                 'User is deactivated, sign up again from a different email address',
//               data: user,
//             })
//           );
//         }
//         // generate new token
//         const newToken = GenerateToken({ data: user, expiresIn: '1m' });
//         res.status(OK).send(
//           sendSuccess({
//             status: true,
//             message: 'Refresh Token Generated',
//             token: newToken,
//           })
//         );
//       } else {
//         return res
//           .status(NOTFOUND)
//           .send(sendError({ status: false, message: NO_USER }));
//       }
//     } else {
//       return res
//         .status(BADREQUEST)
//         .send(sendError({ status: false, message: MISSING_FIELDS }));
//     }
//   } catch (error) {
//     return res.status(401).send({
//       status: 'failed',
//       message: 'Unauthorized User, Not A Valid Token',
//     });
//   }
// };

// @desc    CHANGEPASSWORD
// @route   PUT api / auth / changePassword
// @access  Private

// export const changePassword = async (req, res) => {
//   const userDetails = req.user;
//   try {
//     const user = await Users.findOne({
//       email: userDetails.email,
//     });
//     if (!user) {
//       return res.status(404).json(
//         sendError(
//           { status: false, message: NO_USER })
//       )
//     }

//     const { password, confirmPassword, oldPassword } = req.body;
//     if (oldPassword) {

//       const isValid = compareSync(oldPassword, user.password);
//       if (!isValid) {
//         return res
//           .status(BADREQUEST)
//           .send(
//             sendError({ status: false, message: OLD_PASSWORD_NOT_MATCH })
//           );
//       }
//       if (password !== confirmPassword) {
//         return res
//           .status(BADREQUEST)
//           .send(
//             sendError({ status: false, message: PASSWORD_AND_CONFIRM_NO_MATCH })
//           );
//       }

//       const salt = genSaltSync(10);
//       const newPassword = hashSync(password, salt);
//       const isSame = compareSync(newPassword, user.password);
//       if (isSame) {
//         return res.status(OK).send(
//           sendSuccess({
//             status: false,
//             message: PASSWORD_FAILED,
//             data: null,
//           })
//         );
//       }
//       await Users.findByIdAndUpdate(req.user._id, {
//         $set: { password: newPassword },
//       });
//       return res
//         .status(OK)
//         .send(
//           sendSuccess({ status: true, message: PASSWORD_CHANGE, data: null })
//         );

//     } else {
//       console.log(password, "===>>> password")
//       console.log(confirmPassword, "===>>> confirmPassword")
//       if (password && confirmPassword) {
//         if (password !== confirmPassword) {
//           return res
//             .status(BADREQUEST)
//             .send(
//               sendError({ status: false, message: PASSWORD_AND_CONFIRM_NO_MATCH })
//             );
//         } else {
//           const salt = genSaltSync(10);
//           const newPassword = hashSync(password, salt);
//           const isValid = compareSync(password, user.password);
//           if (isValid) {
//             return res.status(OK).send(
//               sendSuccess({
//                 status: false,
//                 message: PASSWORD_FAILED,
//                 data: null,
//               })
//             );
//           }
//           await Users.findByIdAndUpdate(req.user._id, {
//             $set: { password: newPassword },
//           });
//           return res
//             .status(OK)
//             .send(
//               sendSuccess({ status: true, message: PASSWORD_CHANGE, data: null })
//             );
//         }
//       } else {
//         return res
//           .status(BADREQUEST)
//           .send(sendError({ status: false, message: MISSING_FIELDS }));
//       }
//     }

//   } catch (error) {
//     return res.status(INTERNALERROR).send(
//       sendError({
//         status: false,
//         message: error.message,
//         data: null,
//       })
//     );
//   }
// };

export const changePassword = async (req, res) => {
  const userDetails = req.user;

  try {
    const user = await Users.findOne({ email: userDetails.email });

    if (!user) {
      return res.status(404).json(sendError({ status: false, message: NO_USER }));
    }

    const { password, confirmPassword, oldPassword } = req.body;

    if (!password || !confirmPassword) {
      return res.status(BADREQUEST).send(sendError({ status: false, message: MISSING_FIELDS }));
    }

    if (password !== confirmPassword) {
      return res.status(BADREQUEST).send(sendError({ status: false, message: PASSWORD_AND_CONFIRM_NO_MATCH }));
    }

    if (oldPassword) {
      const isValidOldPassword = compareSync(oldPassword, user.password);

      if (!isValidOldPassword) {
        return res.status(BADREQUEST).send(sendError({ status: false, message: OLD_PASSWORD_NOT_MATCH }));
      }

      // const newPasswordHash = hashSync(password, genSaltSync(10));
      // const isSamePassword = compareSync(password, user.password);

      // if (isSamePassword) {
      //   return res.status(OK).send(sendSuccess({ status: false, message: PASSWORD_FAILED, data: null }));
      // }

      // await Users.findByIdAndUpdate(req.user._id, { $set: { password: newPasswordHash } });
      // return res.status(OK).send(sendSuccess({ status: true, message: PASSWORD_CHANGE, data: null }));

    }
    // else {
    const newPasswordHash = hashSync(password, genSaltSync(10));
    const isSamePassword = compareSync(password, user.password);

    if (isSamePassword) {
      return res.status(OK).send(sendSuccess({ status: false, message: PASSWORD_FAILED, data: null }));
    }

    await Users.findByIdAndUpdate(req.user._id, { $set: { password: newPasswordHash } });
    return res.status(OK).send(sendSuccess({ status: true, message: PASSWORD_CHANGE, data: null }));
    // }

  } catch (error) {
    return res.status(INTERNALERROR).send(sendError({ status: false, message: error.message, data: null }));
  }
};

// @desc    Get Logged In User details
// @route   GET api / auth / userInfo
// @access  Private

export const loggedInUser = async (req, res) => {
  console.log(req.user, "===>>> req.user")
  try {
    const cacheKey = req.originalUrl + process.env.CACHE_KEY + req.user._id;
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      return res.status(OK).send(
        sendSuccess({
          status: true,
          message: GET_SUCCESS_MESSAGES,
          data: JSON.parse(cachedData),
        })
      );
    }
    const response = await Users.findById(req.user._id);

    // Cache the data for 1 hour
    redis.setex(cacheKey, process.env.REDIS_SECONDS, JSON.stringify(response));
    return res.status(OK).send(
      sendSuccess({
        status: true,
        message: GET_SUCCESS_MESSAGES,
        data: response,
      })
    );
  } catch (error) {
    return res.status(INTERNALERROR).send(
      sendError({
        status: false,
        message: error.message,
        data: null,
      })
    );
  }
};

// @desc    Send Forgot Password Reset Email
// @route   POST api/auth/forgotPasswordRequest
// @access  Public

export const forgotPasswordRequest = async (req, res) => {
  try {
    const { email } = req.body;
    if (email) {
      const user = await Users.findOne({ email });
      if (user) {

        const secret = user._id + process.env.JWT_SECRET_KEY;

        const token = GenerateToken({ data: secret, expiresIn: '30m' });

        const link = `${process.env.WEB_LINK || process.env.FRONTEND_BASE_URL}changepassword?q=${token}`;

        // Send forgot Password link via email
        const emailResponse = await sendEmail(user.email, link, 'passwordReset');

        return res.status(CREATED).send(
          sendSuccess({
            status: true,
            message: "Reset Password Link send successfully",
          })
        );

      } else {
        return res
          .status(NOTFOUND)
          .send(sendError({ status: false, message: NO_USER_FOUND }));
      }
    } else {
      return res
        .status(BADREQUEST)
        .send(sendError({ status: false, message: MISSING_FIELD_EMAIL }));
    }
  } catch (error) {
    return res.status(INTERNALERROR).send(
      sendError({
        status: false,
        message: error.message,
        data: null,
      })
    );
  }
};

// @desc    Update Password through Reset Password Link
// @route   POST api/auth/forgotPassword
// @access  Public

export const forgotPassword = async (req, res) => {
  try {
    const { newPassword, confirmNewPassword, token } = req.body;
    if (newPassword && newPassword === confirmNewPassword && token) {
      const { result } = verify(token, process.env.JWT_SECRET_KEY);
      const userId = result.slice(0, result.length - process.env.JWT_SECRET_KEY.length);
      const user = await Users.findById(userId);
      // return res.send(user)
      if (user) {
        const salt = genSaltSync(10);
        const hashedPassword = hashSync(newPassword, salt);
        await Users.findByIdAndUpdate(userId, {
          $set: { password: hashedPassword },
        });
        return res.status(OK).send(
          sendSuccess({
            status: true,
            message: 'Password Updated Successfully',
          })
        );
      } else {
        return res
          .status(NOTFOUND)
          .send(sendError({ status: false, message: responseMessages.NO_USER }));
      }
    } else {
      return res
        .status(BADREQUEST)
        .send(sendError({ status: false, message: responseMessages.MISSING_FIELDS }));
    }
  } catch (error) {
    return res.status(INTERNALERROR).send(
      sendError({
        status: false,
        message: error.message,
        data: null,
      })
    );
  }
};

// @desc    Send Reset Password Email
// @route   POST api/auth/resetPasswordRequest
// @access  Public

export const resetPassword = async (req, res) => {
  try {
    const { password, confirmPassword } = req.body;
    const { id, token } = req.params;
    const user = await Users.findById(id);
    if (user) {
      const secret = user._id + config.jwtSecretKey;

      ValidateToken({ token: token, key: secret });
      res.send(isVerifed);
    } else {
      return res
        .status(NOTFOUND)
        .send(sendError({ status: false, message: NO_USER_FOUND }));
    }

    // if (email) {
    //   const user = await Users.findOne({ "Authentication.Email": email });
    //   if(user){
    //     const secret = user._id + process.env.JWT_SECRET_KEY
    //     const token = GenerateToken({ data: secret , expiresIn :"30m" });
    //     const link = `${ process.env.WEB_LINK } /api/auth / resetPassword / ${ user._id }/${token}`
    //     console.log(link);
    //     return res.status(OK).send(sendSuccess({status : true , message : RESET_LINK_SUCCESS , data : link}))

    //   } else {
    //     return res.status(NOTFOUND).send(sendError({status : false , message : NO_USER_FOUND}))
    //   }
    // } else {
    //   return res
    //     .status(BADREQUEST)
    //     .send(sendError({ status: false, message: MISSING_FIELD_EMAIL }));
    // }
  } catch (error) {
    return res.status(INTERNALERROR).send(
      sendError({
        status: false,
        message: error.message,
        data: null,
      })
    );
  }
};

// @desc    Logout User
// @route   POST api/auth/logout
// @access  Public

// export const logout = async (req, res) => {
//   try {
//     const { token } = req.body;
//     if (token) {
//     } else {
//       return res
//         .status(BADREQUEST)
//         .send(sendError({ status: false, message: MISSING_FIELDS }));
//     }
//   } catch (error) {
//     return res.status(INTERNALERROR).send(
//       sendError({
//         status: false,
//         message: error.message,
//         data: null,
//       })
//     );
//   }
// };

// @desc    Save DeviceId
// @route   POST api/auth/saveDeviceId
// @access  Public

// export const addDeviceId = async (req, res) => {
//   try {
//     console.log(req.body);
//     const { deviceId } = req.body;
//     const id = req.user._id;
//     if (deviceId) {
//       let user = await Users.findOne({ _id: id });
//       if (user) {
//         // update user with this deveiceId
//         user = await Users.findByIdAndUpdate(id, {
//           $set: { 'Authentication.DeviceId': deviceId },
//         });
//         res.status(OK).send(
//           sendSuccess({
//             status: true,
//             message: 'DeviceId Saved Successfully',
//           })
//         );
//       } else {
//         return res
//           .status(OK)
//           .send(sendError({ status: false, message: NO_USER }));
//       }
//     } else {
//       return res
//         .status(BADREQUEST)
//         .send(sendError({ status: false, message: MISSING_FIELDS }));
//     }
//   } catch (error) {
//     return res.status(INTERNALERROR).send(
//       sendError({
//         status: false,
//         message: error.message,
//         data: null,
//       })
//     );
//   }
// };



export async function generateTOTP(req, res) {
  try {

    const { userId } = req.body
    // const user = await Users.findOne({ email: userDetails.email });
    const user = await Users.findById(userId);
    if (!user) {
      return res.status(404).json(sendError({ status: false, message: NO_USER }));
    }

    const totpResponse = await TOTP.findOne({ user: user._id });
    if (totpResponse) {
      return res.status(200).send(sendSuccess({ status: true, message: 'QR code generated successfully', data: totpResponse.QRCode }));
    }

    const appName = 'HiringMine';
    const issuer = 'Hiring Mine';
    const secret = speakeasy.generateSecret({
      length: 32,
      name: `${appName}:${user.email}`,
      issuer: issuer
    });

    // const qrCodeUrl = speakeasy.otpauthURL({
    //   secret: secret.base32,
    //   label: "HiringMine",
    //   // issuer: 'HiringMine'
    // });

    QRCode.toDataURL(secret.otpauth_url, async (err, dataUrl) => {
      if (err) {
        return res.status(BADREQUEST).send(sendError({ status: false, message: 'Error generating QR code' }));
      }
      const obj = {
        user: user._id,
        secret: secret.base32,
        QRCode: dataUrl
      }
      const totp = new TOTP(obj);
      await totp.save();
      // Save the secret.base32 securely for the user
      return res.status(OK).send(sendSuccess({ status: true, message: 'QR code generated successfully', data: dataUrl }));
    });

  } catch (error) {
    return res.status(INTERNALERROR).send(sendError({ status: false, message: error.message, data: null }));
  }
}


export const verifyTOTP = async (req, res) => {
  try {
    const userDetails = req.user;
    const totp = await TOTP.findOne({ user: userDetails._id });
    if (!totp) {
      return res.status(404).json(sendError({ status: false, message: NO_USER }));
    }
    // token => OTP Code
    const { token } = req.body;
    if (!token) {
      return res.status(BADREQUEST).send(sendError({ status: false, message: MISSING_FIELDS }));
    }
    const verified = speakeasy.totp.verify({
      secret: totp.secret,
      encoding: 'base32',
      token: (token)
    });
    if (!verified) {
      return res.status(BADREQUEST).send(sendError({ status: false, message: 'Invalid TOTP code' }));
    }

    return res.status(OK).send(sendSuccess({ status: true, message: 'TOTP verified successfully', data: userDetails }));

  } catch (error) {
    return res.status(INTERNALERROR).send(sendError({ status: false, message: error.message, data: null }));
  }
}

export const resetTOTP = async (req, res) => {
  try {
    const { userId } = req.body

    const user = await Users.findById(userId);
    if (!user) {
      return res.status(404).json(sendError({ status: false, message: NO_USER }));
    }

    const totp = await TOTP.findOne({ user: userId });
    if (!totp) {
      return res.status(404).json(sendError({ status: false, message: NO_USER }));
    }

    const appName = 'HiringMine';
    const issuer = 'Hiring Mine';

    const secret = speakeasy.generateSecret({
      length: 32,
      name: `${appName}:${user.email}`,
      issuer: issuer
    });

    QRCode.toDataURL(secret.otpauth_url, async (err, dataUrl) => {
      if (err) {
        return res.status(BADREQUEST).send(sendError({ status: false, message: 'Error generating QR code' }));
      }
      const obj = {
        // user: user._id,
        secret: secret.base32,
        QRCode: dataUrl
      }

      await TOTP.findByIdAndUpdate({ _id: totp._id }, obj);
      return res.status(OK).send(sendSuccess({ status: true, message: 'QR code generated successfully', data: dataUrl }));
    });

  } catch (error) {
    return res.status(INTERNALERROR).send(sendError({ status: false, message: error.message, data: null }));
  }
}


export const enable2FA = async (req, res) => {
  try {
    const userDetails = req.user
    const user = await Users.findById(userDetails._id);
    if (!user) {
      return res.status(404).json(sendError({ status: false, message: NO_USER }));
    }

    const { enableFlag } = req.body

    if (!enableFlag) {
      await Users.findByIdAndUpdate({ _id: user._id }, { enable2FA: false });
      return res.status(OK).send(sendSuccess({ status: true, message: '2FA disabled successfully' }));
    } else {
      await Users.findByIdAndUpdate({ _id: user._id }, { enable2FA: true });
      req.body.userId = user._id
      generateTOTP(req, res)
    }


  } catch (error) {
    return res.status(INTERNALERROR).send(sendError({ status: false, message: error.message, data: null }));
  }
}


export const checkUserName = async (req, res) => {
  try {
    const { username } = req.params;
    let count;
    const cacheKey = req.originalUrl + process.env.CACHE_KEY;
    count = await redis.get(cacheKey);
    if (count) {
      if (count > 0) {
        return res.status(OK).send(sendSuccess({ status: false, message: `${username} already taken` }));
      } else {
        return res.status(OK).send(sendSuccess({ status: true, message: `${username} is available` }));
      }
    } else {
      // Use countDocuments with a limit of 1 for efficiency
      count = await Users.countDocuments({ userName: username.trim() }).limit(1);
      if (count > 0) {
        redis.setex(cacheKey, process.env.REDIS_SECONDS, JSON.stringify(count));
        return res.status(OK).send(sendSuccess({ status: false, message: `${username} already taken` }));
      } else {
        return res.status(OK).send(sendSuccess({ status: true, message: `${username} is available` }));
      }
    }

  } catch (error) {
    if (error.code === 11000) {  // Duplicate key error
      return res.status(OK).send(sendSuccess({ status: false, message: `${username} already taken` }));
    } else {
      return res.status(INTERNALERROR).send(sendError({ status: false, message: error.message, data: null }));
    }
  }
}





export const VerifyTokenController = async (req, res) => {
  try {
    // Token is already verified in middleware
    // Return decoded user information

    const user = await Users.findById(req.user)

    return res.status(200).send(sendSuccess({
      status: true,
      data: {
        user: user,
        // You can add additional user details here from your database
      }
    }));

  } catch (error) {
    return res.status(500).send(sendError({
      status: false,
      message: 'Error processing request',
      error: error.message
    }));
  }
}


export const GoogleSignIn = async (req, res) => {
  const { access_token } = req.body;
  try {
    if (!access_token) {
      return res.status(BADREQUEST).send(sendError({ status: false, message: 'Access Token is required' }));
    }

    // Get user info from Google
    const googleUserResponse = await axios.get(
      'https://www.googleapis.com/oauth2/v3/userinfo',
      {
        headers: {
          Authorization: `Bearer ${access_token}`
        }
      }
    );

    const {
      sub: googleId,
      given_name: firstName,
      family_name: lastName,
      picture,
      email,
      email_verified
    } = googleUserResponse?.data;
    // Check if user exists
    let user = await Users.findOne({ email });

    if (user) {
      // Check if user was previously registered through custom signup
      if (!user.isGoogleUser && !user.googleId) {
        return res.status(FORBIDDEN).send(
          sendError({
            status: false,
            message: 'This email is already registered. Please login with your password or use a different email for Google login.'
          })
        );
      }

      // Optionally update their profile picture if it changed on Google
      if (picture && picture !== user.profilePic) {
        await Users.findByIdAndUpdate(user._id, { profilePic: picture });
        user.profilePic = picture;
      }

      // If user exists, generate token and return
      user.password = undefined;
      const token = GenerateToken({ data: user, expiresIn: '24h' });

      return res.status(OK).send(
        sendSuccess({
          status: true,
          message: 'Login Successful',
          token,
          data: user
        })
      );
    } else {
      // Create new user similar to custom signup
      const userName = email.split('@')[0].toLowerCase(); // Generate username from email
      const salt = genSaltSync(10);
      const randomPassword = uuidv4(); // Generate random password for Google users

      let doc = new Users({
        firstName,
        lastName,
        email,
        password: hashSync(randomPassword, salt),
        userName,
        totalPoints: 100,
        googleId,
        profilePic: picture,
        isVerified: email_verified, // Google verified email
        isGoogleUser: true
      });

      // Generate referral code
      doc.referralCode = await createReferralCode();

      let savedUser = await doc.save();

      // Save initial points
      const points = new PointsSchema({
        user: savedUser._id,
        points: 100,
        earnedAt: Date.now(),
        reason: 'Registration Bonus',
        category: 'Bonus',
      });
      let savedPoints = await points.save();

      if (savedUser.errors || savedPoints.errors) {
        return res
          .status(INTERNALERROR)
          .send(sendError({ status: false, message: 'Error creating user', error }));
      }

      // Remove sensitive data
      savedUser.password = undefined;

      // Generate token
      const token = GenerateToken({ data: savedUser, expiresIn: '24h' });

      return res.status(CREATED).send(
        sendSuccess({
          status: true,
          message: SUCCESS_REGISTRATION,
          token,
          data: savedUser,
        })
      );
    }

  } catch (error) {
    return res.status(INTERNALERROR).send(
      sendError({
        status: false,
        message: error.message || 'Error processing Google sign in',
        error
      })
    );
  }
};