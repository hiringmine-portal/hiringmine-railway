import express from 'express';
import { validateToken, checkToken } from '../auth/tokenValidation.js';
import {
  approveSkill,
  GetJobs,
  GetReportsJob,
  GetUsers,
  toggleJobActiveStatus,
  toggleJobApprovalStatus,
  toggleJobHiddenStatus,
  ToggleUserStatus
} from '../controller/adminController.js';

const adminRoutes = express.Router();


adminRoutes.put('/skills/:id', checkToken, approveSkill);

// Get All Job
adminRoutes.get('/jobs', checkToken, GetJobs);
adminRoutes.put('/:jobId/toggle-active', checkToken, toggleJobActiveStatus);
adminRoutes.put('/:jobId/toggle-approve', checkToken, toggleJobApprovalStatus);
adminRoutes.put('/:jobId/toggle-hidden', checkToken, toggleJobHiddenStatus);


//Reports Jobs
adminRoutes.get('/reports', checkToken, GetReportsJob);
adminRoutes.get('/users', checkToken, GetUsers);
adminRoutes.put('/:userId/users-status', checkToken, ToggleUserStatus);



export default adminRoutes;
