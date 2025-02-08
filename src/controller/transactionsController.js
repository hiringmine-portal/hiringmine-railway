import { hashSync, genSaltSync, compareSync } from 'bcrypt';
import { sendError, sendSuccess } from '../utils/responses.js';
import {
  ALREADYEXISTS,
  BADREQUEST,
  CREATED,
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
  USER_NAME_EXISTS
} = responseMessages;



// @desc    SIGNUP
// @route   GET api/transactions/:userId
// @access  Public



export const getTransactions = async (req, res) => {
  try {
    const userId = req.params.userId;

    // Fetch transaction history for the user
    const transactions = await PointsSchema.find({ user: userId }).sort({ earnedAt: -1 });

    res.status(200).json(transactions);
  } catch (error) {
    console.error(error.message);
    res.status(500).send('Server Error');
  }
};