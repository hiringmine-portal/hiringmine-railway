import express from 'express';
import { addDropdown, getRecommendationDropdown, getAllCountriesDropdown, getAllCitiesDropdown } from '../controller/dropdownController.js';
// import { addDropdown, getRecommendationDropdown } from '../controller/dropdownController.js';

const dropdownRoutes = express.Router();

dropdownRoutes.post('/recommendation', addDropdown);
dropdownRoutes.get('/recommendation/:id', getRecommendationDropdown);
dropdownRoutes.get('/countries', getAllCountriesDropdown);
dropdownRoutes.get('/cities/:id', getAllCitiesDropdown);

export default dropdownRoutes;