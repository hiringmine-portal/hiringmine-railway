import express from 'express';
import {
    getPendingSkills,
    getSkills
} from '../controller/skillsController.js';

const skillsRoutes = express.Router();

// Get all approved (active) skills
skillsRoutes.get('/', getSkills);

// Get all pending (inactive) skills
skillsRoutes.get('/pending', getPendingSkills);

export default skillsRoutes;
