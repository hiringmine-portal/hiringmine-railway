import express from 'express';
import multer from 'multer';
import path from 'path';
import { validateToken, checkToken } from '../auth/tokenValidation.js';

import AWS from 'aws-sdk'
import { get } from 'http';
import { addSponsorViews } from '../controller/sponsorsController.js';

const sponsorsRoutes = express.Router();



sponsorsRoutes.put('/', addSponsorViews);

export default sponsorsRoutes;
