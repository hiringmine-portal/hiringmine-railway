import express from 'express';
import multer from 'multer';
import path from 'path';
import { validateToken, checkToken } from '../auth/tokenValidation.js';
import {
  addJobAds,
  getJobAds,
  getJobAd,
  dislike,
  like,
  addView,
  updateJobAd,
  deleteJobAd,
  ReportJobController,
  approveJob,
  EasyApplyController,
  generateJobPosting,
  getRecommendedJobs,
  generateJobPostByImage,
  // getJobAdsByHashTags,
  //   updateJobAds,
  //   deleteJobAds,
  //   getJobAdsByTags,
  //   getRecentJobAds,
  //   getJobAdsByCategory,
  //   getJobAdsBySubCategory,
  //   getJobAdsByCountry,
  //   getJobAdsByProfile,
  //   getUserFollowingJobAds,
  //   getJobAdsByHashTags,
  //   searchAll,
  //   searchUsers,
  //   searchJobAds,
  //   searchHashTagsJobAds,
  //   searchHashTags,
  //   share,
} from '../controller/jobAdsController.js';
import { jobPostingRateLimiter } from '../middleware/rateLimit.js';
import fs from 'fs';
// ===========>>>>>>>>>>>>>>>>>>>MULTER<<<<<<<<<<<<<<<<<<=============
// destination: 'uploads',
const fileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Create base uploads directory if it doesn't exist
    // const fs = require('fs');
    const baseDir = 'uploads';
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir);
    }

    let uploadPath = 'uploads/photos'; // Default path

    switch (file.fieldname) {
      case 'video':
        uploadPath = 'uploads/videos';
        break;
      case 'video_thumbnail':
        uploadPath = 'uploads/video_thumbnails';
        break;
      case 'audio':
        uploadPath = 'uploads/audios';
        break;
      case 'audio_thumbnail':
        uploadPath = 'uploads/audio_thumbnails';
        break;
      case 'postImages':
        uploadPath = 'uploads/photos';
        break;
    }

    // Create specific upload directory if it doesn't exist
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileUpload = multer({
  storage: fileStorage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter(req, file, cb) {
    if (file.fieldname === 'video') {
      if (!file.originalname.match(/\.(mp4|MPEG-4|mkv)$/i)) {
        return cb(new Error('Please upload a valid video format (mp4, MPEG-4, mkv)'));
      }
    } else if (file.fieldname === 'audio') {
      if (!file.originalname.match(/\.(mp3)$/i)) {
        return cb(new Error('Please upload a valid audio format (mp3)'));
      }
    } else if (['video_thumbnail', 'audio_thumbnail', 'postImages'].includes(file.fieldname)) {
      if (!file.originalname.match(/\.(png|jpg|jpeg|jif)$/i)) {
        return cb(new Error('Please upload a valid image format (png, jpg, jpeg, jif)'));
      }
    }
    cb(null, true);
  }
});

// ===========>>>>>>>>>>>>>>>>>>>MULTER<<<<<<<<<<<<<<<<<<=============

const jobAdsRoutes = express.Router();

jobAdsRoutes.post('/', validateToken, jobPostingRateLimiter, addJobAds);
jobAdsRoutes.put('/:jobId', validateToken, updateJobAd);
jobAdsRoutes.delete('/:jobId', validateToken, deleteJobAd);
jobAdsRoutes.get('/all', checkToken, getJobAds);
jobAdsRoutes.get('/recommended', checkToken, getRecommendedJobs);
jobAdsRoutes.get('/:id', checkToken, getJobAd);
// jobAdsRoutes.get('/hashTags', checkToken, getJobAdsByHashTags);
jobAdsRoutes.put('/like/:jobAdId', validateToken, like);
jobAdsRoutes.put('/dislike/:jobAdId', validateToken, dislike);
jobAdsRoutes.put('/view/:id', addView);
// POST /api/jobs/:jobId/report
jobAdsRoutes.post('/:jobId/report', validateToken, ReportJobController);
jobAdsRoutes.post('/approve/:jobId', approveJob);

jobAdsRoutes.post('/easy-apply', validateToken, EasyApplyController);
jobAdsRoutes.post('/pre-fill/job',
  validateToken,
  generateJobPosting);
jobAdsRoutes.put("/pre-fill-image/job", fileUpload.single("postImages"), generateJobPostByImage);


// jobAdsRoutes.put(
//   '/:id',
//   validateToken,
//   fileUpload.fields([
//     { name: 'video_thumbnail', maxCount: 1 },
//     { name: 'video', maxCount: 1 },
//     { name: 'audio_thumbnail', maxCount: 1 },
//     { name: 'audio', maxCount: 1 },
//     { name: 'postImages', maxCount: 25 },
//   ]),
//   updateJobAds
// );
// jobAdsRoutes.delete('/:id', validateToken, deleteJobAds);
// jobAdsRoutes.get('/recentjobAds', checkToken, getRecentJobAds);
// jobAdsRoutes.get('/category', checkToken, getJobAdsByCategory);
// jobAdsRoutes.get('/subCategory', checkToken, getJobAdsBySubCategory);
// jobAdsRoutes.get('/country', checkToken, getJobAdsByCountry);
// jobAdsRoutes.get('/userProfile', checkToken, getJobAdsByProfile);
// jobAdsRoutes.get('/userFollowingjobAds', checkToken, getUserFollowingJobAds);
// jobAdsRoutes.get('/hashTags', checkToken, getJobAdsByHashTags);
// jobAdsRoutes.get('/searchAll', checkToken, searchAll);
// jobAdsRoutes.get('/searchUsers', checkToken, searchUsers);
// jobAdsRoutes.get('/searchjobAds', checkToken, searchJobAds);
// jobAdsRoutes.get('/searchHashTagsjobAds', checkToken, searchHashTagsJobAds);
// jobAdsRoutes.get('/searchHashTags', checkToken, searchHashTags);
// jobAdsRoutes.get('/tags', checkToken, getJobAdsByTags);
// jobAdsRoutes.put('/share/:postId', validateToken, share);

export default jobAdsRoutes;
