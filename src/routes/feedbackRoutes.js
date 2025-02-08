import express from "express";
import { createFeedback, getAllFeedbacks } from "../controller/feedbackController.js";
import { validateToken } from "../auth/tokenValidation.js";

const feedbackRoutes = express.Router()

// post feedback route ==>
// feedbackRoutes.post('/' , createFeedback);
feedbackRoutes.post('/',validateToken ,createFeedback);
feedbackRoutes.get('/getAllFeedbacks', getAllFeedbacks);

export default feedbackRoutes