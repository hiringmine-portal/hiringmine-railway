

import express from 'express';
import multer from 'multer';
import path from 'path';
import { validateToken, checkToken } from '../auth/tokenValidation.js';
import { addCategory, getCategories } from '../controller/categoriesController.js';

// ===========>>>>>>>>>>>>>>>>>>>MULTER<<<<<<<<<<<<<<<<<<=============
// destination: 'uploads',


// ===========>>>>>>>>>>>>>>>>>>>MULTER<<<<<<<<<<<<<<<<<<=============

const categoriesRoutes = express.Router();

categoriesRoutes.post('/', validateToken, addCategory);
categoriesRoutes.get('/all', checkToken, getCategories);
// categoriesRoutes.get('/:id', checkToken, getCategory);

export default categoriesRoutes;
