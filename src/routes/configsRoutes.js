import express from 'express';
import { getMaintenance } from '../controller/configsController.js';
// import { addDropdown, getRecommendationDropdown } from '../controller/dropdownController.js';

const configsRoutes = express.Router();

configsRoutes.get('/maintenance', getMaintenance);

export default configsRoutes;