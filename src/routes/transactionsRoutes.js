import express from 'express';
import multer from 'multer';
import path from 'path';
import { validateToken, checkToken } from '../auth/tokenValidation.js';

import AWS from 'aws-sdk'
import { get } from 'http';
import { getTransactions } from '../controller/transactionsController.js';

const transactionsRoutes = express.Router();



transactionsRoutes.get('/:userId', getTransactions);

export default transactionsRoutes;
