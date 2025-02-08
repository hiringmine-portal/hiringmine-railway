import express from 'express';
import multer from 'multer';
import path from 'path';
import multerS3 from "multer-s3"
import { validateToken, checkToken } from '../auth/tokenValidation.js';
import {
  activateUser,
  deactivateUser,
  getUsers,
  getUser,
  getUsersByCountry,
  updateUser,
  addView,
  updateUserPic,
  deleteUserPic,
  referredUsers,
  updateSocialLinks,
  addEducation,
  updateEducation,
  deleteEducation,
  addRecommendation,
  deleteRecommendation,
  updateRecommendation,
  addExperience,
  updateExperience,
  deleteExperience,
  addCertification,
  updateCertification,
  deleteCertification,
  addSkills,
  ProfileViewController,
  addAppreciation,
  getAppreciators,
  getUsersAppreciatedBy,
  unappreciateUser,
  removeSkills,
  UploadResumeController,
  DeleteResumeController,
  ReportProfileController,
  DownloadResumeController,
  ResumePrivacyController,
  getUserResumeDownloadStats,
  getLinkedinData,
  linkedinPopShown,
  getHomeUsers
} from '../controller/usersController.js';
import AWS from 'aws-sdk'
import { config } from '../config/default.js';
import { createRateLimiter } from '../middleware/rateLimit.js';
import checkDownloadLimit from '../middleware/checkDownloadLimit.js';

const userRoutes = express.Router();

// ===========>>>>>>>>>>>>>>>>>>>MULTER<<<<<<<<<<<<<<<<<<=============

// destination: 'uploads',
const imageStorage = multer.diskStorage({
  // Destination to store image
  destination: (req, file, cb) => {
    if (file.fieldname === 'Image') {
      // if uploading profile Image
      cb(null, 'uploads/profile/image');
    }

    if (file.fieldname === 'coverImage') {
      // if uploading Cover photo
      cb(null, 'uploads/profile/cover');
    }
  },

  filename: (req, file, cb) => {
    cb(
      null,
      file.fieldname + '_' + Date.now() + path.extname(file.originalname)
    );
    // file.fieldname is name of the field (image)
    // path.extname get the uploaded file extension
  },
});

const imageUpload = multer({
  storage: imageStorage,
  fileFilter(req, file, cb) {
    // if uploading image
    if (!file.originalname.match(/\.(png|jpg|jpeg)$/)) {
      // upload only png and jpg format
      return cb(new Error('Please upload an Image'));
    }

    cb(undefined, true);
  },
});

// Create S3 instance
const s3 = new AWS.S3();

// Multer middleware for S3 upload
const s3Storage = multer.memoryStorage(); // Store files temporarily in memory

// Configure AWS SDK
AWS.config.update({
  accessKeyId: config.accessKeyId,
  secretAccessKey: config.secretAccessKey,
  region: 'ap-southeast-2', // e.g., 'us-east-1'
});

const s3Upload = multer({
  storage: s3Storage,
  fileFilter(req, file, cb) {
    if (!file.originalname.match(/\.(png|jpg|jpeg)$/)) {
      return cb(new Error('Please upload an image'));
    }
    cb(null, true);
  }
});


// Middleware function to upload image to S3
function uploadToS3(fieldname, folder, imageType) {
  return (req, res, next) => {
    const upload = s3Upload.single(fieldname);
    upload(req, res, async function (err) {
      if (err) {
        return res.status(400).send({ error: err.message });
      }

      const fileContent = req.file.buffer;
      const params = {
        Bucket: 'singabucket.hiringmine',
        Key: `${folder}/${Date.now()}-${req.file.originalname}`, // Modify as per your folder structure
        Body: fileContent,
      };

      try {
        const data = await s3.upload(params).promise();
        if (imageType === 'profile') {
          req.profileImageUrl = data.Location;
        } else if (imageType === 'cover') {
          req.coverImageUrl = data.Location;
        }
        next();
      } catch (err) {
        console.error('Error uploading to S3:', err);
        return res.status(500).send({ error: 'Error uploading to S3' });
      }
    });
  };
}


// Configure multer for handling file uploads
const uploadPDFToS3 = multer({
  storage: multerS3({
    s3: s3,
    bucket: "singabucket.hiringmine",
    metadata: function (req, file, cb) {
      cb(null, { fieldName: file.fieldname });
    },
    key: function (req, file, cb) {
      cb(null, 'profile/cover/' + Date.now() + '-' + file.originalname);
    }
  }),
  fileFilter: function (req, file, cb) {
    if (file.mimetype !== 'application/pdf') {
      return cb(new Error('Only PDF files are allowed!'), false);
    }
    cb(null, true);
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // limit file size to 5MB
  }
});


// ===========>>>>>>>>>>>>>>>>>>>MULTER<<<<<<<<<<<<<<<<<<=============

userRoutes.get('/', checkToken, createRateLimiter(10 * 60 * 1000, 50, 'Too many requests, please try again later.'), getUsers);
userRoutes.get('/home', checkToken, createRateLimiter(10 * 60 * 1000, 50, 'Too many requests, please try again later.'), getHomeUsers);
userRoutes.get('/referred', validateToken, referredUsers);
userRoutes.get('/:id', checkToken, createRateLimiter(10 * 60 * 1000, 40, 'Too many requests, please try again later.'), getUser);
userRoutes.post('/country', validateToken, getUsersByCountry);
userRoutes.put(
  '/',
  validateToken,
  createRateLimiter(30 * 60 * 1000, 15, 'Too many profile updates, please try again later.'),
  updateUser
);
userRoutes.post(
  '/update-social-links',
  validateToken,
  updateSocialLinks
);
userRoutes.post(
  '/education',
  validateToken,
  createRateLimiter(10 * 60 * 1000, 5, 'Too many education additions, please try again later.'),
  addEducation
);
userRoutes.put(
  '/education/:eduid',
  validateToken,
  createRateLimiter(10 * 60 * 1000, 5, 'Too many education updates, please try again later.'),
  updateEducation
);
userRoutes.delete(
  '/education/:eduid',
  validateToken,
  createRateLimiter(10 * 60 * 1000, 3, 'Too many delete operations, please try again later.'),
  deleteEducation
);
userRoutes.post(
  '/experience',
  validateToken,
  createRateLimiter(10 * 60 * 1000, 5, 'Too many experience additions, please try again later.'),
  addExperience
);
userRoutes.put(
  '/experience/:expid',
  validateToken,
  createRateLimiter(10 * 60 * 1000, 5, 'Too many experience updates, please try again later.'),
  updateExperience
);
userRoutes.delete(
  '/experience/:expid',
  validateToken,
  createRateLimiter(10 * 60 * 1000, 3, 'Too many delete operations, please try again later.'),
  deleteExperience
);
userRoutes.post(
  '/certification',
  validateToken,
  createRateLimiter(10 * 60 * 1000, 5, 'Too many certifications additions, please try again later.'),
  addCertification
);
userRoutes.put(
  '/certification/:certid',
  validateToken,
  createRateLimiter(10 * 60 * 1000, 5, 'Too many certifications updates, please try again later.'),
  updateCertification
);
userRoutes.delete(
  '/certification/:certid',
  validateToken,
  createRateLimiter(10 * 60 * 1000, 3, 'Too many delete operations, please try again later.'),
  deleteCertification
);



userRoutes.post(
  '/recommendation',
  validateToken,
  createRateLimiter(10 * 60 * 1000, 5, 'Too many recommendation attempts, please try again later.'),
  addRecommendation
);
userRoutes.put(
  '/recommendation/:id',
  validateToken,
  createRateLimiter(10 * 60 * 1000, 5, 'Too many recommendation updates, please try again later.'),
  updateRecommendation
);
userRoutes.delete(
  '/recommendation/:id',
  validateToken,
  createRateLimiter(5 * 60 * 1000, 10, 'Too many appreciations, please try again later.'),
  deleteRecommendation
);



userRoutes.put(
  '/uploadProfilePic',
  validateToken,
  uploadToS3('Image', 'profile/image', 'profile'),
  createRateLimiter(30 * 60 * 1000, 3, 'Too many picture uploads, please try again later.'),
  updateUserPic
);
userRoutes.put(
  '/uploadCoverPic',
  validateToken,
  uploadToS3('coverImage', 'profile/cover', 'cover'),
  createRateLimiter(30 * 60 * 1000, 3, 'Too many picture uploads, please try again later.'),
  updateUserPic
);
userRoutes.put(
  '/deletePic',
  validateToken,
  createRateLimiter(30 * 60 * 1000, 2, 'Too many picture uploads, please try again later.'),
  deleteUserPic
);
// userRoutes.put(
//   '/',
//   validateToken,
//   // imageUpload.fields([
//   //   { name: 'Image', maxCount: 1 },
//   //   { name: 'coverImage', maxCount: 1 },
//   // ]),
//   updateUser
// );
userRoutes.put('/deactivate/:id', validateToken, deactivateUser);
userRoutes.put('/activate/:id', validateToken, activateUser);
userRoutes.put('/view/:id', addView);
userRoutes.put('/skills', validateToken, addSkills);
userRoutes.put('/skills/remove', validateToken, removeSkills);
userRoutes.post('/profile-view/:profileId',
  validateToken,
  ProfileViewController);

userRoutes.post('/appreciation/:appreciatedUserId', validateToken, addAppreciation);
userRoutes.get('/:userId/appreciators/', getAppreciators);
userRoutes.get('/:userId/appreciated-users', getUsersAppreciatedBy);
userRoutes.put('/unappreciate/:appreciatedUserId', validateToken, unappreciateUser);
userRoutes.put('/upload-resume', [validateToken, uploadPDFToS3.single('resume')], UploadResumeController);
userRoutes.delete('/delete-resume', validateToken, DeleteResumeController);
userRoutes.get("/resume/download-resume", validateToken, checkDownloadLimit, DownloadResumeController);
userRoutes.put("/resume/privacy", validateToken, ResumePrivacyController);
userRoutes.get("/downloads", validateToken, getUserResumeDownloadStats);
userRoutes.post("/importLinkedinData", validateToken, getLinkedinData);
userRoutes.put("/linkedinPopShown", validateToken, linkedinPopShown);
// userRoutes.post("/importLinkedinData", getLinkedinData);

userRoutes.post('/:profileId/report', validateToken, ReportProfileController);

export default userRoutes;
