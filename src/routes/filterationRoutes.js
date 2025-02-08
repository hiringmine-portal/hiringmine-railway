

import express from 'express';
import multer from 'multer';
import path from 'path';
import { validateToken, checkToken } from '../auth/tokenValidation.js';
import { addFilteration, getFilteration } from '../controller/filterationController.js';


const filterationRoutes = express.Router();

filterationRoutes.post('/', validateToken, addFilteration);
filterationRoutes.get('/all', checkToken, getFilteration);

export default filterationRoutes;
