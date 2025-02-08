

import express from 'express';
import multer from 'multer';
import path from 'path';
import { validateToken, checkToken } from '../auth/tokenValidation.js';
import { createSocialLinkOptions, getSocialLinkOptions } from '../controller/socialLinkController.js';


const socialLinkRoutes = express.Router();

socialLinkRoutes.post('/', validateToken, createSocialLinkOptions);
socialLinkRoutes.get('/', getSocialLinkOptions);

export default socialLinkRoutes;
