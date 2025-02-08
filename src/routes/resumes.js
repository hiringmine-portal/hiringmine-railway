import express from 'express';
import { getResumeDownloadLogs, logResumeDownload } from '../controller/resumesController.js';
import { validateToken } from '../auth/tokenValidation.js';

const resumesRoutes = express.Router();

resumesRoutes.post('/download', validateToken, logResumeDownload)
resumesRoutes.get('/download-logs', getResumeDownloadLogs)

export default resumesRoutes;