import Feedback from "../models/FeedbackSchema.js";
import { responseMessages } from "../constants/responseMessages.js";
import {
  BADREQUEST,
  CREATED,
  INTERNALERROR,
  OK,
} from "../constants/httpStatus.js";
import { sendError, sendSuccess } from "../utils/responses.js";

const { ADD_SUCCESS_MESSAGES, INTERNAL_ERROR_MESSAGE } = responseMessages;

// POST: Create Feedback
export const createFeedback = async (req, res) => {
  // console.log(req)
  try {
    const { feedback, rating, selectedOptions, userId } = req.body;

    // Create new feedback entry
    const newFeedback = new Feedback({
      feedback,
      rating,
      selectedOptions,
      userId,
    });

    // Save to database
    await newFeedback.save();

    return res.status(CREATED).send(
      sendSuccess({
        status: OK,
        message: ADD_SUCCESS_MESSAGES,
        data: newFeedback,
      })
    );
  } catch (error) {
    return res.status(BADREQUEST).send(
      sendError({
        status: false,
        message: INTERNAL_ERROR_MESSAGE,
        error: error.message,
      })
    );
  }
};

// Get: Fetch All Feedbacks
export const getAllFeedbacks = async (req, res) => {
  try {
    const feedbacks = await Feedback.find();

    res.status(CREATED).json({
      success: OK,
      data: feedbacks,
    });
  } catch (error) {
    res.status(INTERNALERROR).json({
      success: false,
      message: "Failed to fetch feedbacks!",
      error: error.message,
    });
  }
};