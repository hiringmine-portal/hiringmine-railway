import { sendError, sendSuccess } from '../utils/responses.js';
import { INTERNALERROR, OK, BADREQUEST, NOTFOUND, CREATED } from '../constants/httpStatus.js';
import Users from '../models/Register.js';
import { responseMessages } from '../constants/responseMessages.js';
import pkg from 'jsonwebtoken';
import socialLinkOptionSchema from '../models/SocialLinkOptionSchema.js';
import mongoose from 'mongoose';
import Education from '../models/EducationSchema.js';
import Recommendation from '../models/RecommendationSchema.js';
import Experience from '../models/ExperienceSchema.js';
import Certification from '../models/CertificationSchema.js';
import Skills from '../models/Skills.js';
import profileViewSchema from '../models/profileViewSchema.js';
import AppreciationSchema from '../models/AppreciationSchema.js';
import AWS from 'aws-sdk';
import { config } from '../config/default.js';
import { redis } from '../app.js';
import { scanAndDelete } from '../utils/index.js';
import ReportSchema from '../models/ReportSchema.js';
import { fetchLinkedinData, mapLinkedInDataToExperience, uploadImageToS3 } from '../helpers/genericFunctions.js';

const { verify } = pkg;

const {
  GET_SUCCESS_MESSAGES,
  GET_UNSUCCESS_MESSAGES,
  UPDATE_SUCCESS_MESSAGES,
  PROFILE_UPDATE_SUCCESS_MESSAGES,
  PIC_UPDATE_SUCCESS_MESSAGES,
  SUCCESS_ACTIVATE,
  SUCCESS_DEACTIVATE,
  MISSING_FIELDS
} = responseMessages;

// @desc    USERS
// @route   GET api/users/
// @access  Public

export const getUsers = async (req, res) => {
  try {
    const cacheKey = req.originalUrl + process.env.CACHE_KEY;
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      return res.status(OK).send(
        sendSuccess({
          status: true,
          message: GET_SUCCESS_MESSAGES,
          data: JSON.parse(cachedData),
        })
      );
    }
    let { pageNo = 1, limit = 10, sortBy: sort, type, salary: expectedSalaryRange, availibility: openToWork, education, experience: experienceRange, keyWord: keyword } = req.query;
    pageNo = parseInt(pageNo);
    limit = parseInt(limit);

    // Calculate skip value based on pageNo and limit
    const skip = (pageNo - 1) * limit;

    // Define default sorting by createdAt
    let sortBy = { $sort: { createdAt: -1 } };

    // If views parameter is provided, sort by views
    if (sort === 'mostViewed') {
      sortBy = { $sort: { views: -1 } };
    }
    if (sort === 'recommended') {
      sortBy = { $sort: { recommendationsCount: -1 } };
    }
    if (sort === 'mostAppreciated') {
      sortBy = { $sort: { appreciations: -1 } };
    }

    let experienceRangeFilter = {};
    if (experienceRange) {
      const experienceRangesArray = experienceRange.split(","); // Split multiple experience ranges
      const orClauses = [];

      // Iterate over each experience range to construct OR clauses
      experienceRangesArray.forEach(range => {
        const [minExperience, maxExperience] = range.split("-").map(Number);
        orClauses.push({ totalWorkExperience: { $gte: minExperience, $lte: maxExperience } });
      });

      // Construct the filter for experience range based on multiple ranges
      experienceRangeFilter = { $or: orClauses };
    }

    // Filter by keyword in designation, jobTitle, or description
    let keywordFilter = {};
    if (keyword) {
      keywordFilter = {
        $match: {
          $or: [
            { jobTitle: { $regex: keyword, $options: 'i' } }, // Case-insensitive regex match for jobTitle
            { description: { $regex: keyword, $options: 'i' } }, // Case-insensitive regex match for description
            { userName: { $regex: keyword, $options: 'i' } }, // Case-insensitive regex match for userName
            { firstName: { $regex: keyword, $options: 'i' } }, // Case-insensitive regex match for firstName
            { lastName: { $regex: keyword, $options: 'i' } }, // Case-insensitive regex match for lastName
            { fullName: { $regex: keyword, $options: 'i' } }, // Match the fullName field
            { "skillsDetails.name": { $regex: keyword, $options: 'i' } }, // Match skill names
          ],
        },
      };
    }


    let expectedSalaryRangeFilter = {};
    if (expectedSalaryRange) {
      const expectedSalaryRangesArray = expectedSalaryRange.split(","); // Split multiple salary ranges
      const rangeArr = [];

      // Iterate over each salary range to extract min and max values
      expectedSalaryRangesArray.forEach(_expectedSalaryRange => {
        const [_min, _max] = _expectedSalaryRange.split("-").map(Number);
        rangeArr.push(_min, _max);
      });

      // Calculate the overall min and max values from all salary ranges
      const min = Math.min(...rangeArr);
      const max = Math.max(...rangeArr);

      // Construct the filter for salary range based on multiple ranges
      expectedSalaryRangeFilter = {
        $or: [
          { expectedSalaryRangeStart: { $lte: min }, expectedSalaryRangeEnd: { $gte: min } }, // min of the job's range is before or at the min of the query range
          { expectedSalaryRangeStart: { $lte: max }, expectedSalaryRangeEnd: { $gte: max } }, // max of the job's range is after or at the max of the query range
          { expectedSalaryRangeStart: { $gte: min }, expectedSalaryRangeEnd: { $lte: max } } // Job's range is completely within the query range
        ]
      };
    }

    let openToWorkFilter = {};
    if (openToWork) {
      openToWorkFilter = { $match: { openToWork: true } };
    } else {
      openToWorkFilter = {
        $match: {
          $or: [
            { openToWork: true },
            { openToWork: false }
          ]
        }
      };
    }

    // ** NEW: Filter by education level (degree) **
    let educationFilter = {};
    if (education) {
      educationFilter = {
        $match: {
          "education.degree": { $regex: education, $options: 'i' }, // Case-insensitive regex match for degree
        }
      };
    }

    // Perform aggregation to fetch user data with education and experience details
    // Aggregation pipeline
    const pipeline = [
      {
        $lookup: {
          from: 'experiences', // Experience collection name
          localField: '_id',
          foreignField: 'user',
          as: 'experience' // Name for the field to store experience details
        }
      },
      {
        $lookup: {
          from: 'educations', // Education collection
          localField: '_id',
          foreignField: 'user',
          as: 'education', // Storing education details in 'education' field
        }
      },
      {
        $unwind: { path: '$experience', preserveNullAndEmptyArrays: true }
      },
      {
        $unwind: { path: '$education', preserveNullAndEmptyArrays: true } // Unwind education array for filtering
      },
      {
        $addFields: {
          fullName: { $concat: ['$firstName', ' ', '$lastName'] }, // Concatenate firstName and lastName
        },
      },
      // Lookup to fetch skill details
      {
        $lookup: {
          from: "skills", // Skills collection
          localField: "skills", // Field in Users collection
          foreignField: "_id", // Field in Skills collection
          as: "skillsDetails", // Output array field
        },
      },

      // Optionally filter users based on skills only if 'keyword' or 'skills' filter is present
      ...(keyword ? [
        {
          $match: {
            skillsDetails: {
              $exists: true,
              $ne: []  // Ensure the user has skills (only if a keyword is provided)
            }
          }
        }
      ] : []),
      // Add keyword filter stage
      // Add keyword filter stage conditionally
      ...(Object.keys(keywordFilter).length > 0 ? [keywordFilter] : []),
      { $match: expectedSalaryRangeFilter }, // Filter users by salary range
      openToWorkFilter, // Filter users who are open to work
      { $match: experienceRangeFilter }, // Filter users by experience range
      ...(Object.keys(educationFilter).length > 0 ? [educationFilter] : []), // Add education filter
      {
        $group: {
          _id: '$_id',
          userName: { $first: '$userName' },
          firstName: { $first: '$firstName' },
          mobileVerified: { $first: '$mobileVerified' },
          lastName: { $first: '$lastName' },
          coverPhoto: { $first: '$coverPhoto' },
          profilePic: { $first: '$profilePic' },
          totalWorkExperience: { $first: '$totalWorkExperience' }, // Include totalWorkExperience field
          experience: { $push: '$experience' }, // Group experience entries back into an array
          education: { $push: '$education' }, // Group education entries
          createdAt: { $first: '$createdAt' }, // Projecting createdAt field
          views: { $first: '$views' }, // Projecting views field
          expectedSalaryRangeStart: { $first: '$expectedSalaryRangeStart' }, // Projecting salaryRangeStart field
          expectedSalaryRangeEnd: { $first: '$expectedSalaryRangeEnd' }, // Projecting salaryRangeEnd field
          recommendationsReceived: { $first: '$recommendationsReceived' }, // Projecting recommendationsReceived field
          resumeUrl: { $first: '$resumeUrl' },
          appreciations: { $first: '$appreciations' },
          jobTitle: { $first: '$jobTitle' },

        }
      },
      {
        $project: {
          userName: 1,
          firstName: 1,
          mobileVerified: 1,
          lastName: 1,
          _id: 1,
          coverPhoto: 1,
          profilePic: 1,
          totalExperience: 1,
          createdAt: 1,
          views: 1,
          experience: 1,
          education: 1, // Include education details in the result
          expectedSalaryRangeStart: 1,
          expectedSalaryRangeEnd: 1,
          totalWorkExperience: 1,
          resumeUrl: 1,
          recommendationsReceived: { $ifNull: ['$recommendationsReceived', []] }, // Ensure recommendationsReceived is an array
          appreciations: 1,
          jobTitle: 1,

        }
      },
      {
        $addFields: {
          recommendationsCount: { $size: '$recommendationsReceived' } // Count the number of recommendations received
        }
      },
      sortBy,
      { $skip: skip }, // Skip documents based on pagination
      { $limit: limit } // Limit the number of documents returned
    ];

    // If type parameter is provided, add a $match stage to filter by type

    if (type) {
      const typesArray = type.split(','); // Split comma-separated types into an array
      pipeline.splice(1, 0, {
        $match: { workPreference: { $in: typesArray } } // Match documents where type is in the provided types
      });
    }

    let allUsersData = await Users.aggregate(pipeline);
    const totalCount = await Users.aggregate([...pipeline, { $count: 'totalCount' }]);
    const usersCount = totalCount.length > 0 ? totalCount[0].totalCount : 0;


    // Check if any users exist
    if (allUsersData.length === 0) {
      return res.status(200).json(sendSuccess({
        message: 'No users found',
        status: true,
        data: [],
        count: usersCount,
      }));
      {

      }
    }

    // Cache the response data
    redis.setex(cacheKey, process.env.REDIS_SECONDS, JSON.stringify(allUsersData));

    return res.status(OK).send(
      sendSuccess({
        status: true,
        message: GET_SUCCESS_MESSAGES,
        data: allUsersData,
        count: usersCount,
      })
    );
  } catch (error) {
    return res.status(INTERNALERROR).send(
      sendError({
        status: false,
        message: error.message,
        data: null,
      })
    );
  }
};
// @desc    USERS HOME
// @route   GET api/users/home
// @access  Public

export const getHomeUsers = async (req, res) => {
  try {
    const cacheKey = req.originalUrl + process.env.CACHE_KEY;
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      return res.status(OK).send(
        sendSuccess({
          status: true,
          message: GET_SUCCESS_MESSAGES,
          data: JSON.parse(cachedData),
        })
      );
    }
    let { pageNo = 1, limit = 10, sortBy: sort } = req.query;
    pageNo = parseInt(pageNo);
    limit = parseInt(limit);

    // Calculate skip value based on pageNo and limit
    const skip = (pageNo - 1) * limit;

    // Define default sorting by createdAt
    let sortBy = { createdAt: -1 };

    // If views parameter is provided, sort by views
    if (sort === 'mostViewed') {
      sortBy = { views: -1 };
    }
    if (sort === 'recommended') {
      sortBy = { recommendationsCount: -1 };
    }
    if (sort === 'mostAppreciated') {
      sortBy = { appreciations: -1 };
    }

    // Count total users for pagination
    const usersCount = await Users.countDocuments();

    console.log(sortBy, "==>> sortBy");

    // fetch users from the database by simple find query
    let allUsersData = await Users.find({})
      .select('firstName lastName userName profilePic jobTitle') // Include only the required fields
      .sort(sortBy).limit(limit).skip(skip).lean();


    // Check if any users exist
    if (allUsersData.length === 0) {
      return res.status(200).json(sendSuccess({
        message: 'No users found',
        status: true,
        data: [],
        count: usersCount,
      }));
      {

      }
    }

    // Cache the response data
    redis.setex(cacheKey, process.env.REDIS_SECONDS, JSON.stringify(allUsersData));

    return res.status(OK).send(
      sendSuccess({
        status: true,
        message: GET_SUCCESS_MESSAGES,
        data: allUsersData,
        count: usersCount,
      })
    );
  } catch (error) {
    return res.status(INTERNALERROR).send(
      sendError({
        status: false,
        message: error.message,
        data: null,
      })
    );
  }
};

// @desc    USER
// @route   GET api/users/id
// @access  Public

// export const getUser = async (req, res) => {
//   try {
//     const userId = req?.user?._id;
//     const id = req.params.id;
//     if (id) {
//       const user = await Users.findOne(
//         { _id: id },
//         {
//           Meta: 0,
//           IsVerified: 0,
//           IsActivate: 0,
//           createdAt: 0,
//           updatedAt: 0,
//           'Authentication.Password': 0,
//           'Config.IsParental': 0,
//           'Config.Parent': 0,
//           'Config.IsInvited': 0,
//           'Config.InvitedBy': 0,
//           'Config.InvitationKey': 0,
//           'Config.AllowInvite': 0,
//           'Config.CountInvite': 0,
//           'Config.OnBoarded': 0,
//         }
//       ).lean();
//       if (user) {
//         user.followers = 0;
//         user.followings = 0;
//         user.isFollow = false;
//         if (user.Config.followers) {
//           let followersUsers = user.Config.followers;
//           for (let l = 0; l < followersUsers.length; l++) {
//             if (followersUsers[l] == userId) {
//               user.isFollow = true;
//             }
//           }
//           user.followers = user.Config.followers.length;
//         }
//         if (user.Config.followings) {
//           user.followings = user.Config.followings.length;
//         }
//         return res.status(OK).send(
//           sendSuccess({
//             status: true,
//             message: GET_SUCCESS_MESSAGES,
//             data: user,
//           })
//         );
//       } else {
//         return res.status(INTERNALERROR).send(
//           sendSuccess({
//             status: false,
//             message: GET_UNSUCCESS_MESSAGES,
//             data: null,
//           })
//         );
//       }
//     } else {
//       return res
//         .status(BADREQUEST)
//         .send(sendError({ status: false, message: MISSING_FIELDS }));
//     }
//   } catch (error) {
//     return res.status(INTERNALERROR).send(
//       sendError({
//         status: false,
//         message: error.message,
//         data: null,
//       })
//     );
//   }
// };

export const getUser = async (req, res) => {
  try {
    const userId = req?.user?._id;
    let { id } = req.params; // id can be either userId or userName
    console.log(id, "==>> id");

    const user = await Users.findOne({ userName: id });
    id = user._id.toString(); // Set id to the userId if userName is found

    const cacheKey = req.originalUrl + process.env.CACHE_KEY + userId;
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      return res.status(OK).send(
        sendSuccess({
          status: true,
          message: GET_SUCCESS_MESSAGES,
          data: JSON.parse(cachedData),
        })
      );
    }
    if (id) {

      //Define aggregation pipeline stages
      const pipeline = [
        {
          $match: { _id: mongoose.Types.ObjectId(id) } // Match the specific user
        },
        {
          $lookup: {
            from: 'educations', // Education collection name
            localField: '_id',
            foreignField: 'user',
            as: 'education' // Name for the field to store education details
          }
        },
        {
          $lookup: {
            from: 'skills', // Skills collection name
            localField: 'skills',
            foreignField: '_id',
            as: 'skills' // Name for the field to store skills details
          }
        },
        {
          $lookup: {
            from: 'experiences', // Education collection name
            localField: '_id',
            foreignField: 'user',
            as: 'experience' // Name for the field to store education details
          }
        },
        {
          $lookup: {
            from: 'certifications', // Education collection name
            localField: '_id',
            foreignField: 'user',
            as: 'certification' // Name for the field to store education details
          }
        },
        {
          $lookup: {
            from: 'recommendations', // Recommendation collection name
            let: { receivedIds: '$recommendationsReceived' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $cond: {
                      if: { $isArray: '$$receivedIds' }, // Check if recommendationsReceived is an array
                      then: { $in: ['$_id', '$$receivedIds'] }, // Find recommendations received by the user
                      else: false // Return false if recommendationsReceived is not an array
                    }
                  }
                }
              },
              {
                $lookup: {
                  from: 'users', // User collection name
                  localField: 'giver',
                  foreignField: '_id',
                  as: 'giver' // Name for the field to store giver details
                }
              },
              {
                $lookup: {
                  from: 'users', // User collection name
                  localField: 'receiver',
                  foreignField: '_id',
                  as: 'receiver' // Name for the field to store receiver details
                }
              },
              {
                $project: {
                  message: 1,
                  relationship: 1,
                  position: 1,
                  createdAt: 1,
                  visibility: 1,
                  giver: { $arrayElemAt: ['$giver', 0] }, // Unwind the giver array
                  receiver: { $arrayElemAt: ['$receiver', 0] } // Unwind the receiver array
                }
              },
              {
                $project: {
                  'giver._id': 1,
                  'giver.userName': 1,
                  'giver.firstName': 1,
                  'giver.lastName': 1,
                  'giver.profilePic': 1,
                  'giver.jobTitle': 1,
                  'receiver._id': 1,
                  'receiver.userName': 1,
                  'receiver.firstName': 1,
                  'receiver.lastName': 1,

                  message: 1,
                  relationship: 1,
                  position: 1,
                  visibility: 1,
                  createdAt: 1
                }
              },
              {
                $sort: { createdAt: -1 } // Sort recommendations by createdAt in descending order
              }
            ],
            as: 'recommendationsReceived' // Name for the field to store recommendations received
          }
        },
        {
          $lookup: {
            from: 'recommendations', // Recommendation collection name
            let: { receivedIds: '$recommendationsGiven' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $cond: {
                      if: { $isArray: '$$receivedIds' }, // Check if recommendationsReceived is an array
                      then: { $in: ['$_id', '$$receivedIds'] }, // Find recommendations received by the user
                      else: false // Return false if recommendationsReceived is not an array
                    }
                  }
                }
              },
              {
                $lookup: {
                  from: 'users', // User collection name
                  localField: 'giver',
                  foreignField: '_id',
                  as: 'giver' // Name for the field to store giver details
                }
              },
              {
                $lookup: {
                  from: 'users', // User collection name
                  localField: 'receiver',
                  foreignField: '_id',
                  as: 'receiver' // Name for the field to store receiver details
                }
              },
              {
                $project: {
                  message: 1,
                  relationship: 1,
                  position: 1,
                  createdAt: 1,
                  giver: { $arrayElemAt: ['$giver', 0] }, // Unwind the giver array
                  receiver: { $arrayElemAt: ['$receiver', 0] } // Unwind the receiver array
                }
              },
              {
                $project: {
                  'giver._id': 1,
                  'giver.userName': 1,
                  'giver.firstName': 1,
                  'giver.lastName': 1,
                  'giver.profilePic': 1,
                  'giver.jobTitle': 1,
                  'receiver._id': 1,
                  'receiver.userName': 1,
                  'receiver.firstName': 1,
                  'receiver.lastName': 1,
                  'receiver.profilePic': 1,
                  'receiver.jobTitle': 1,
                  message: 1,
                  relationship: 1,
                  position: 1,
                  createdAt: 1
                }
              },
              {
                $sort: { createdAt: -1 } // Sort recommendations by createdAt in descending order
              }
            ],
            as: 'recommendationsGiven' // Name for the field to store recommendations received
          }
        },
        {
          $project: { password: 0 } // Exclude the password field from the result
        },
        {
          $unwind: { path: '$experience', preserveNullAndEmptyArrays: true } // Unwind the experience array // Unwind the experience array
        },
        {
          $sort: {
            "experience.startYear": -1 // Sort by start year in ascending order
          }
        },
        // {
        //   $unwind: { path: '$recommendationsReceived', preserveNullAndEmptyArrays: true } // Unwind the experience array // Unwind the experience array
        // },
        // {
        //   $sort: {
        //     "recommendationsReceived.createdAt": -1 // Sort by start year in ascending order
        //   }
        // },
        // {
        //   $unwind: { path: '$recommendationsGiven', preserveNullAndEmptyArrays: true } // Unwind the experience array // Unwind the experience array
        // },
        // {
        //   $sort: {
        //     "recommendationsGiven.createdAt": -1 // Sort by start year in ascending order
        //   }
        // },
        {
          $group: {
            _id: "$_id",
            experience: { $push: "$experience" }, // Group experience entries back into an array
            // Add other fields to include in the result
            firstName: { $first: "$firstName" },
            lastName: { $first: "$lastName" },
            mobileVerified: { $first: "$mobileVerified" },
            userName: { $first: "$userName" },
            resumeUrl: { $first: "$resumeUrl" },
            email: { $first: "$email" },
            country: { $first: "$country" },
            city: { $first: "$city" },
            dateOfBirth: { $first: "$dateOfBirth" },
            description: { $first: "$description" },
            jobTitle: { $first: "$jobTitle" },
            profilePic: { $first: "$profilePic" },
            coverPhoto: { $first: "$coverPhoto" },
            education: { $first: "$education" },
            certification: { $first: "$certification" },
            views: { $first: "$views" },
            recommendationsReceived: { $first: "$recommendationsReceived" },
            recommendationsGiven: { $first: "$recommendationsGiven" },
            openToWork: { $first: "$openToWork" }, // Add openToWork field
            workPreference: { $first: "$workPreference" }, // Add workPreference field
            interestedInPosition: { $first: "$interestedInPosition" }, // Add interestedInPosition field
            currentSalary: { $first: "$currentSalary" }, // Add currentSalary field
            expectedSalaryRangeStart: { $first: "$expectedSalaryRangeStart" }, // Add expectedSalaryRangeStart field
            expectedSalaryRangeEnd: { $first: "$expectedSalaryRangeEnd" }, // Add expectedSalaryRangeEnd field
            totalWorkExperience: { $first: "$totalWorkExperience" }, // Add totalWorkExperience field
            skills: { $first: "$skills" } // Include skills in the final result
          }
        }
        // {
        //   $lookup: {
        //     from: 'socialLinks', // SocialLink collection name
        //     localField: 'socialLinks.platform',
        //     foreignField: '_id',
        //     as: 'socialLinks' // Name for the field to store social links details
        //   }
        // }
      ]
      // Perform aggregation to fetch user data with education and social links details
      const userWithDetails = await Users.aggregate(pipeline);


      // Populate social links field in the user document
      const populatedUser = await Users.populate(userWithDetails, { path: 'socialLinks.platform' });
      // Calculate total experience years
      let totalExperienceYears = 0;

      if (userWithDetails.length > 0 && userWithDetails[0]?.experience) {

        userWithDetails[0]?.experience.forEach((exp) => {
          const startDate = new Date(exp.startYear, exp.startMonth);
          const endDate = exp.endYear ? new Date(exp.endYear, exp.endMonth) : new Date();
          const durationInMilliseconds = endDate - startDate;
          const durationInYears = durationInMilliseconds / (1000 * 60 * 60 * 24 * 365);
          totalExperienceYears += durationInYears;
        });

        // Round total experience years to two decimal places
        totalExperienceYears = Math.round(totalExperienceYears * 100) / 100;

        // Include total experience years in the result
        userWithDetails[0].totalExperienceYears = totalExperienceYears;
      }

      // Check if user exists
      if (userWithDetails.length === 0) {
        return res.status(404).json(sendError({ message: 'User not found' }));
      }

      // Fetch appreciation data for the target user (id)
      const appreciation = await AppreciationSchema.findOne({ userId: id });

      // Check if the current logged-in user has appreciated this user
      const hasAppreciated = appreciation?.appreciatedBy.includes(userId);

      // Add the "appreciated" flag to the response
      userWithDetails[0].appreciated = hasAppreciated || false;

      // Cache the response data
      redis.setex(cacheKey, process.env.REDIS_SECONDS, JSON.stringify(userWithDetails[0]));

      // Return user object with education and social links details
      return res.status(OK).send(
        sendSuccess({
          status: true,
          message: GET_SUCCESS_MESSAGES,
          data: userWithDetails[0],
        })
      );
    } else {
      return res
        .status(BADREQUEST)
        .send(sendError({ status: false, message: MISSING_FIELDS }));
    }

  } catch (error) {
    console.log(error.message, "=>> error message")
  }
}

// @desc   USERS
// @route  GET api/users/referred
// @access Public

export const referredUsers = async (req, res) => {
  try {
    // Get the current user's ID from request or session
    const currentUserId = req.user._id; // Assuming you have implemented user authentication

    // Find users who have the referrerId matching the current user's ID
    const referredUsers = await Users.find({ referrerId: currentUserId });

    // Return the list of referred users
    res.status(200).json(sendSuccess({ success: true, data: referredUsers }));
  } catch (error) {
    console.error('Error fetching referred users:', error);
    res.status(500).json(sendError({ success: false, message: 'Internal server error' }));
  }
};

// @desc    USERS
// @route   POST api/users/country
// @access  Public

export const getUsersByCountry = async (req, res) => {
  try {
    const { country } = req.body;

    const users = await Users.find(
      { Country: { $regex: country, $options: 'i' } },
      {
        Meta: 0,
        IsVerified: 0,
        IsActivate: 0,
        createdAt: 0,
        updatedAt: 0,
        'Authentication.Password': 0,
        'Config.IsParental': 0,
        'Config.Parent': 0,
        'Config.IsInvited': 0,
        'Config.InvitedBy': 0,
        'Config.InvitationKey': 0,
        'Config.AllowInvite': 0,
        'Config.CountInvite': 0,
        'Config.OnBoarded': 0,
      }
    );

    return res.status(OK).send(
      sendSuccess({
        status: true,
        message: GET_SUCCESS_MESSAGES,
        data: users,
      })
    );
  } catch (error) {
    return res.status(INTERNALERROR).send(
      sendError({
        status: false,
        message: error.message,
        data: null,
      })
    );
  }
};

// @desc    USERS
// @route   POST api/users/city
// @access  Public

export const getUsersByCity = async (req, res) => {
  try {
    const { city } = req.body;

    const users = await Users.find(
      { City: { $regex: city, $options: 'i' } },
      {
        Meta: 0,
        IsVerified: 0,
        IsActivate: 0,
        createdAt: 0,
        updatedAt: 0,
        'Authentication.Password': 0,
        'Config.IsParental': 0,
        'Config.Parent': 0,
        'Config.IsInvited': 0,
        'Config.InvitedBy': 0,
        'Config.InvitationKey': 0,
        'Config.AllowInvite': 0,
        'Config.CountInvite': 0,
        'Config.OnBoarded': 0,
      }
    );

    return res.status(OK).send(
      sendSuccess({
        status: true,
        message: GET_SUCCESS_MESSAGES,
        data: users,
      })
    );
  } catch (error) {
    return res.status(INTERNALERROR).send(
      sendError({
        status: false,
        message: error.message,
        data: null,
      })
    );
  }
};

// @desc    USERS
// @route   PUT api/users/
// @access  Private

export const updateUser = async (req, res) => {

  const id = req.user._id; // Retrieve the user's ID


  const pattern = `/api/users/${id}${process.env.CACHE_KEY}*`
  await scanAndDelete(pattern);
  await redis.del(`/api/auth/get-userInfo${process.env.CACHE_KEY}${id}`);
  // redis.del();


  try {
    let body = req.body;

    // Update the user's fields

    const updateUser = await Users.findByIdAndUpdate(
      { _id: id },
      {
        $set: {
          firstName: body.firstName,
          lastName: body.lastName,
          dateOfBirth: body.dateOfBirth,
          gender: body.gender,
          country: body.country,
          city: body.city,
          jobTitle: body.jobTitle,
          description: body.description,
          mobileVerified: body.mobileVerified,
          mobileNumber: body.mobileNumber,
          userName: body.userName?.toLowerCase().trim(),
          // New fields to be updated
          openToWork: body.openToWork, // Boolean
          workPreference: body.workPreference, // Array or String depending on schema
          interestedInPosition: body.interestedInPosition, // String
          currentSalary: body.currentSalary, // Number or String depending on how salary is stored
          expectedSalaryRangeStart: body.expectedSalaryRangeStart, // Number or String
          expectedSalaryRangeEnd: body.expectedSalaryRangeEnd, // Number or String
          totalWorkExperience: body.totalWorkExperience, // Number representing years or months of experience
          mobileVerified: body?.mobileVerified
          // 'SocialLinks.fb': body.fb,
          // 'SocialLinks.twitter': body.twitter,
          // 'SocialLinks.instagram': body.instagram,
          // 'SocialLinks.linkedin': body.linkedin,
        },
      },
      { runValidators: true, context: 'query', new: true }
    );
    if (updateUser) {
      return res.status(OK).send(
        sendSuccess({
          status: true,
          message: PROFILE_UPDATE_SUCCESS_MESSAGES,
          data: null,
        })
      );
    } else {
      return res.status(INTERNALERROR).send(
        sendSuccess({
          status: false,
          message: 'not updated',
          data: null,
        })
      );
    }
  } catch (error) {
    console.log(error, "==>> error")
    return res.status(INTERNALERROR).send(
      sendError({
        status: false,
        message: error.message,
        data: null,
      })
    );
  }
};
// @desc    USERS SOCIAL LINKS
// @route   PUT api/users/update-social-links
// @access  Private

export const updateSocialLinks = async (req, res) => {

  const userId = req.user._id;

  const { platformId, url } = req.body; // Assuming platformId is the ID of the selected social platform

  try {
    // Find the user by ID
    const user = await Users.findById(userId);

    if (!user) {
      return res.status(404).json(sendError({ message: 'User not found' }));
    }

    // Find the social link option by ID
    const socialLinkOption = await socialLinkOptionSchema.findById(platformId);

    if (!socialLinkOption) {
      return res.status(404).json(sendError({ message: 'Social link option not found' }));
    }
    const { platform } = socialLinkOption;
    const objectIdPlatformId = mongoose.Types.ObjectId(platformId)
    // Check if the user already has a social link for the given platform
    const existingSocialLinkIndex = user.socialLinks.findIndex(link => link.platform.equals(objectIdPlatformId));

    if (existingSocialLinkIndex !== -1) {
      // Update the existing social link URL
      user.socialLinks[existingSocialLinkIndex].url = url;
    } else {
      // Add a new social link
      user.socialLinks.push({ platform: platformId, url });
    }

    // Save the updated user profile
    await user.save();

    res.status(200).json(sendSuccess({ message: 'User social links updated successfully', user }));
  } catch (error) {
    return res.status(INTERNALERROR).send(
      sendError({
        status: false,
        message: error.message,
        data: null,
      })
    );
  }
};

// @desc    USERS ADD EDUCATION
// @route   POST api/users/education
// @access  Private

export const addEducation = async (req, res) => {
  try {

    const userId = req.user._id;

    const pattern = `/api/users/${userId}${process.env.CACHE_KEY}*`
    await scanAndDelete(pattern);
    await redis.del(`/api/auth/get-userInfo${process.env.CACHE_KEY}${userId}`);

    const educationData = req.body;
    educationData.user = userId;

    const education = new Education(educationData);
    await education.save();

    res.status(200).json(sendSuccess({ message: 'Education added successfully', data: education, status: true }));
  } catch (error) {
    return res.status(INTERNALERROR).send(
      sendError({
        status: false,
        message: error.message,
        data: null,
      })
    );
  }
};

// @desc    USERS UPDATE EDUCATION
// @route   PUT api/users/education/:eduid
// @access  Private

export const updateEducation = async (req, res) => {
  try {
    const userId = req.user._id;


    const pattern = `/api/users/${userId}${process.env.CACHE_KEY}*`
    await scanAndDelete(pattern);
    await redis.del(`/api/auth/get-userInfo${process.env.CACHE_KEY}${userId}`);

    const { eduid } = req.params;

    const updatedEducationData = req.body;

    const education = await Education.findOneAndUpdate(
      { _id: eduid, user: userId },
      updatedEducationData,
      { new: true }
    );

    if (!education) {
      return res.status(404).json(sendError({ message: 'Education not found' }));
    }

    res.json(sendSuccess({ message: 'Education updated successfully', data: education, status: true }));
  } catch (error) {
    return res.status(INTERNALERROR).send(
      sendError({
        status: false,
        message: error.message,
        data: null,
      })
    );
  }
};

// @desc    USERS DELETE EDUCATION
// @route   DELETE api/users/education/:eduid
// @access  Private

export const deleteEducation = async (req, res) => {
  try {
    const userId = req.user._id;


    const pattern = `/api/users/${userId}${process.env.CACHE_KEY}*`
    await scanAndDelete(pattern);
    await redis.del(`/api/auth/get-userInfo${process.env.CACHE_KEY}${userId}`);

    const { eduid } = req.params;

    await Education.findOneAndDelete({ _id: eduid, user: userId });

    res.json(sendSuccess({ message: 'Education deleted successfully', status: true }));
  } catch (error) {
    return res.status(INTERNALERROR).send(
      sendError({
        status: false,
        message: error.message,
        data: null,
      })
    );
  }
};


// @desc    USERS ADD EXPERIENCE
// @route   POST api/users/experience
// @access  Private

export const addExperience = async (req, res) => {
  try {
    const userId = req.user._id;

    const pattern = `/api/users/${userId}${process.env.CACHE_KEY}*`
    await scanAndDelete(pattern);
    await redis.del(`/api/auth/get-userInfo${process.env.CACHE_KEY}${userId}`);

    const experienceData = req.body;
    experienceData.user = userId;

    const experience = new Experience(experienceData);

    // Calculate the duration of the experience
    const startDate = new Date(experienceData.startYear, experienceData.startMonth);
    const endDate = experienceData.endYear ? new Date(experienceData.endYear, experienceData.endMonth) : new Date();
    const durationInMilliseconds = endDate - startDate;
    const durationInYears = durationInMilliseconds / (1000 * 60 * 60 * 24 * 365);

    // Set the totalDuration field in the experience document
    experience.totalDuration = durationInYears;

    await experience.save();

    // Update the total work experience for the user
    const user = await Users.findById(userId);

    // Update the totalWorkExperience field in the user document
    user.totalWorkExperience += durationInYears;
    await user.save();
    res.status(200).json(sendSuccess({ status: true, message: 'Experience added successfully', data: experience }));
  } catch (error) {
    return res.status(INTERNALERROR).send(
      sendError({
        status: false,
        message: error.message,
        data: null,
      })
    );
  }
};

// @desc    USERS UPDATE Experience
// @route   PUT api/users/experience/:expid
// @access  Private

export const updateExperience = async (req, res) => {
  try {
    const userId = req.user._id;
    const pattern = `/api/users/${userId}${process.env.CACHE_KEY}*`
    await scanAndDelete(pattern);
    await redis.del(`/api/auth/get-userInfo${process.env.CACHE_KEY}${userId}`);
    const { expid } = req.params;
    const updatedExperienceData = req.body;

    // Find the existing experience record
    const existingExperience = await Experience.findOne({ _id: expid, user: userId });
    if (!existingExperience) {
      return res.status(404).json(sendError({ message: 'Experience not found' }));
    }

    // Calculate the change in duration caused by the update
    const { startYear, startMonth, endYear, endMonth } = updatedExperienceData;
    const startDate = new Date(startYear, startMonth);
    const endDate = endYear ? new Date(endYear, endMonth) : new Date();
    const oldStartDate = new Date(existingExperience.startYear, existingExperience.startMonth);
    const oldEndDate = existingExperience.endYear ? new Date(existingExperience.endYear, existingExperience.endMonth) : new Date();
    const oldDurationInMilliseconds = oldEndDate - oldStartDate;
    const oldDurationInYears = oldDurationInMilliseconds / (1000 * 60 * 60 * 24 * 365);
    const newDurationInMilliseconds = endDate - startDate;
    const newDurationInYears = newDurationInMilliseconds / (1000 * 60 * 60 * 24 * 365);
    const durationChangeInYears = newDurationInYears - oldDurationInYears;

    // Update the totalDuration field in the experience document
    updatedExperienceData.totalDuration = newDurationInYears;

    // Update the experience record
    const updatedExperience = await Experience.findByIdAndUpdate(
      expid,
      updatedExperienceData,
      { new: true }
    );

    // Find the user document and update the totalWorkExperience field
    const user = await Users.findById(userId);
    user.totalWorkExperience += durationChangeInYears;
    await user.save();

    res.json(sendSuccess({ status: true, message: 'Experience updated successfully', data: updatedExperience }));
  } catch (error) {
    return res.status(INTERNALERROR).send(
      sendError({
        status: false,
        message: error.message,
        data: null,
      })
    );
  }
};

// @desc    USERS DELETE Experience
// @route   DELETE api/users/experience/:eduid
// @access  Private

export const deleteExperience = async (req, res) => {
  try {
    const userId = req.user._id;
    const pattern = `/api/users/${userId}${process.env.CACHE_KEY}*`
    await scanAndDelete(pattern);
    await redis.del(`/api/auth/get-userInfo${process.env.CACHE_KEY}${userId}`);
    const { expid } = req.params;

    // Find the experience record to be deleted
    const experienceToDelete = await Experience.findOne({ _id: expid, user: userId });
    if (!experienceToDelete) {
      return res.status(404).json(sendError({ message: 'Experience not found' }));
    }

    // Calculate the duration of the experience to be deleted
    const { startYear, startMonth, endYear, endMonth } = experienceToDelete;
    const startDate = new Date(startYear, startMonth);
    const endDate = endYear ? new Date(endYear, endMonth) : new Date();
    const durationInMilliseconds = endDate - startDate;
    const durationInYears = durationInMilliseconds / (1000 * 60 * 60 * 24 * 365);

    // Find the user document and update the totalWorkExperience field
    const user = await Users.findById(userId);
    user.totalWorkExperience -= durationInYears;
    await user.save();

    // Delete the experience record
    await Experience.findOneAndDelete({ _id: expid, user: userId });

    res.json(sendSuccess({ message: 'Experience deleted successfully', status: true, }));
  } catch (error) {
    return res.status(INTERNALERROR).send(
      sendError({
        status: false,
        message: error.message,
        data: null,
      })
    );
  }
};

// @desc    USERS ADD Certification
// @route   POST api/users/certification
// @access  Private

export const addCertification = async (req, res) => {
  try {
    const userId = req.user._id;

    const pattern = `/api/users/${userId}${process.env.CACHE_KEY}*`
    await scanAndDelete(pattern);
    await redis.del(`/api/auth/get-userInfo${process.env.CACHE_KEY}${userId}`);

    const certificationData = req.body;
    certificationData.user = userId;

    const certification = new Certification(certificationData);
    await certification.save();

    res.status(200).json(sendSuccess({ message: 'Certification added successfully', data: certification, status: true }));
  } catch (error) {
    return res.status(INTERNALERROR).send(
      sendError({
        status: false,
        message: error.message,
        data: null,
      })
    );
  }
};

// @desc    USERS UPDATE Certification
// @route   PUT api/users/certification/:certid
// @access  Private

export const updateCertification = async (req, res) => {
  try {
    const userId = req.user._id;

    const pattern = `/api/users/${userId}${process.env.CACHE_KEY}*`
    await scanAndDelete(pattern);
    await redis.del(`/api/auth/get-userInfo${process.env.CACHE_KEY}${userId}`);
    const { certid } = req.params;

    const updatedCertificationData = req.body;

    const certification = await Certification.findOneAndUpdate(
      { _id: certid, user: userId },
      updatedCertificationData,
      { new: true }
    );

    if (!certification) {
      return res.status(404).json(sendError({ message: 'Certificate not found' }));
    }

    res.json(sendSuccess({ message: 'Certificate updated successfully', data: certification, status: true }));
  } catch (error) {
    return res.status(INTERNALERROR).send(
      sendError({
        status: false,
        message: error.message,
        data: null,
      })
    );
  }
};

// @desc    USERS DELETE Certification
// @route   DELETE api/users/certification/:certid
// @access  Private

export const deleteCertification = async (req, res) => {
  try {
    const userId = req.user._id;

    const pattern = `/api/users/${userId}${process.env.CACHE_KEY}*`
    await scanAndDelete(pattern);
    await redis.del(`/api/auth/get-userInfo${process.env.CACHE_KEY}${userId}`);

    const { certid } = req.params;

    await Certification.findOneAndDelete({ _id: certid, user: userId });

    res.json(sendSuccess({ message: 'Certificate deleted successfully', status: true }));
  } catch (error) {
    return res.status(INTERNALERROR).send(
      sendError({
        status: false,
        message: error.message,
        data: null,
      })
    );
  }
};


// @desc    USERS ADD RECOMMENDATION
// @route   ADD api/users/recommendation/
// @access  Private

export const addRecommendation = async (req, res) => {
  try {
    const userId = req.user._id;
    const pattern = `/api/users/${userId}${process.env.CACHE_KEY}*`
    await scanAndDelete(pattern);
    await redis.del(`/api/auth/get-userInfo${process.env.CACHE_KEY}${userId}`);


    const { receiver, message, relationship, position } = req.body;
    const recommendation = new Recommendation({ giver: userId, receiver, message, relationship, position });
    const savedRecommendation = await recommendation.save();

    // Update recommendationsGiven and recommendationsReceived fields in users schema
    await Users.findByIdAndUpdate(userId, { $push: { recommendationsGiven: savedRecommendation._id } });
    await Users.findByIdAndUpdate(receiver, { $push: { recommendationsReceived: savedRecommendation._id } });

    // Fetch complete data of the giver user
    const giverUser = await Users.findById(userId);

    savedRecommendation.giver = giverUser;

    res.status(201).json(sendSuccess({ data: savedRecommendation, status: true, message: "successfully recommendation" }));

  } catch (error) {
    return res.status(INTERNALERROR).send(
      sendError({
        status: false,
        message: error.message,
        data: null,
      })
    );
  }
};
// @desc    USERS UPDATE RECOMMENDATION
// @route   UPDATE api/users/recommendation/
// @access  Private

export const updateRecommendation = async (req, res) => {
  try {
    const userId = req.user._id;

    const pattern = `/api/users/${userId}${process.env.CACHE_KEY}*`
    await scanAndDelete(pattern);
    await redis.del(`/api/auth/get-userInfo${process.env.CACHE_KEY}${userId}`);

    const { id } = req.params;
    const { message, position, relationship, visibility } = req.body;
    const updatedRecommendation = await Recommendation.findByIdAndUpdate(
      id,
      { message, position, relationship, visibility },
      { new: true },
    );
    if (!updatedRecommendation) {
      return res.status(404).json(sendError({ message: 'Recommendation not found' }));
    }
    res.json(sendSuccess({ message: 'Recommendation updated successfully', data: updatedRecommendation, status: true }));

  } catch (error) {
    return res.status(INTERNALERROR).send(
      sendError({
        status: false,
        message: error.message,
        data: null,
      })
    );
  }
};

// @desc    USERS DELETE RECOMMENDATION
// @route   DELETE api/users/recommendation/
// @access  Private

export const deleteRecommendation = async (req, res) => {
  try {
    const userId = req.user._id;

    const pattern = `/api/users/${userId}${process.env.CACHE_KEY}*`
    await scanAndDelete(pattern);
    await redis.del(`/api/auth/get-userInfo${process.env.CACHE_KEY}${userId}`);

    const { id } = req.params;
    const deletedRecommendation = await Recommendation.findByIdAndDelete(id);
    if (!deletedRecommendation) {
      return res.status(404).json(sendError({ message: 'Recommendation not found' }));
    }

    // Update recommendationsGiven and recommendationsReceived fields in users schema
    await Users.findByIdAndUpdate(deletedRecommendation.giver, { $pull: { recommendationsGiven: id } });
    await Users.findByIdAndUpdate(deletedRecommendation.receiver, { $pull: { recommendationsReceived: id } });

    res.json(sendSuccess({ message: 'Recommendation deleted successfully', status: true }));

  } catch (error) {
    return res.status(INTERNALERROR).send(
      sendError({
        status: false,
        message: error.message,
        data: null,
      })
    );
  }
};



// @desc    USERS
// @route   PUT api/users/
// @access  Private

export const updateUserPic = async (req, res) => {
  const id = req.user._id;
  const pattern = `/api/users/${id}${process.env.CACHE_KEY}*`
  await scanAndDelete(pattern);
  await redis.del(`/api/auth/get-userInfo${process.env.CACHE_KEY}${id}`);

  try {
    let ProfilePic;
    let CoverPhoto;
    let url;
    if (req.profileImageUrl) {
      ProfilePic = req.profileImageUrl;
      url = req.profileImageUrl
    }
    if (req.coverImageUrl) {
      CoverPhoto = req.coverImageUrl;
      url = req.coverImageUrl
    }
    const updateUser = await Users.findByIdAndUpdate(
      { _id: id },
      {
        $set: {
          profilePic: ProfilePic,
          coverPhoto: CoverPhoto,
        },
      },
      { runValidators: true, context: 'query', new: true }
    );
    if (updateUser) {
      return res.status(OK).send(
        sendSuccess({
          status: true,
          message: PIC_UPDATE_SUCCESS_MESSAGES,
          data: url,
        })
      );
    } else {
      return res.status(INTERNALERROR).send(
        sendSuccess({
          status: false,
          message: 'not updated',
          data: null,
        })
      );
    }
  } catch (error) {
    return res.status(INTERNALERROR).send(
      sendError({
        status: false,
        message: error.message,
        data: null,
      })
    );
  }
};
// @desc    USERS
// @route   PUT api/users/
// @access  Private

export const deleteUserPic = async (req, res) => {
  const id = req.user._id;
  const pattern = `/api/users/${id}${process.env.CACHE_KEY}*`
  await scanAndDelete(pattern);
  await redis.del(`/api/auth/get-userInfo${process.env.CACHE_KEY}${id}`);
  const { profile, cover } = req.query

  try {
    if (!profile && !cover) {
      return res.status(INTERNALERROR).send(
        sendSuccess({
          status: false,
          message: 'No Query Param added',
          data: null,
        })
      );
    }
    if (profile) {
      const updateUser = await Users.findByIdAndUpdate(
        { _id: id },
        {
          $set: {
            'profilePic': null,
          },
        },
        { runValidators: true, context: 'query', new: true }
      );
    }
    if (cover) {
      const updateUser = await Users.findByIdAndUpdate(
        { _id: id },
        {
          $set: {
            'coverPhoto': null,
          },
        },
        { runValidators: true, context: 'query', new: true }
      );
    }

    if (updateUser) {
      return res.status(OK).send(
        sendSuccess({
          status: true,
          message: UPDATE_SUCCESS_MESSAGES,
          data: null,
        })
      );
    } else {
      return res.status(INTERNALERROR).send(
        sendSuccess({
          status: false,
          message: 'not updated',
          data: null,
        })
      );
    }
  } catch (error) {
    return res.status(INTERNALERROR).send(
      sendError({
        status: false,
        message: error.message,
        data: null,
      })
    );
  }
};

// @desc    USERS
// @route   PUT api/users/deactivate/:id
// @access  Private

export const deactivateUser = async (req, res) => {
  const { id } = req.params;
  const pattern = `/api/users/${id}${process.env.CACHE_KEY}*`
  await scanAndDelete(pattern);
  await redis.del(`/api/auth/get-userInfo${process.env.CACHE_KEY}${id}`);
  const pattern2 = `/api/users?limit=*&pageNo=*&keyWord=*&category=*${process.env.CACHE_KEY}`
  await scanAndDelete(pattern2);

  try {
    const updateUser = await Users.findByIdAndUpdate(
      id,
      {
        IsActivate: false,
      },
      {
        new: true,
      }
    );
    updateUser &&
      res.status(200).send(
        sendSuccess({
          status: true,
          message: SUCCESS_DEACTIVATE,
          data: null,
        })
      );
  } catch (error) {
    return res.status(INTERNALERROR).send(
      sendError({
        status: false,
        message: error.message,
        data: null,
      })
    );
  }
};

// @desc    USERS
// @route   PUT api/users/activate/:id
// @access  Private

export const activateUser = async (req, res) => {
  const { id } = req.params;
  const pattern = `/api/users/${id}${process.env.CACHE_KEY}*`
  await scanAndDelete(pattern);
  await redis.del(`/api/auth/get-userInfo${process.env.CACHE_KEY}${id}`);
  const pattern2 = `/api/users?limit=*&pageNo=*&keyWord=*&category=*${process.env.CACHE_KEY}`
  await scanAndDelete(pattern2);

  try {
    const updateUser = await Users.findByIdAndUpdate(
      id,
      {
        IsActivate: true,
      },
      {
        new: true,
      }
    );
    updateUser &&
      res.status(200).send(
        sendSuccess({
          status: true,
          message: SUCCESS_ACTIVATE,
          data: null,
        })
      );
  } catch (error) {
    return res.status(INTERNALERROR).send(
      sendError({
        status: false,
        message: error.message,
        data: null,
      })
    );
  }
};

// @desc    update User View By Id
// @route   PUT api/users/view/:id
// @access  Public
export const addView = async (req, res, next) => {
  try {
    await Users.findByIdAndUpdate(req.params.id, {
      $inc: { views: 1 },
    })
    return res.status(OK).send(
      sendSuccess({
        status: true,
        message: 'The view has been increased.',
      })
    );
  } catch (error) {
    return res.status(INTERNALERROR).send(
      sendError({
        status: false,
        message: error.message,
        data: null,
      })
    );
  }
};

// @desc    update User Skills
// @route   PUT api/users/skills
// @access  Public
export const addSkills = async (req, res) => {
  try {
    const { skills } = req.body; // 'skills' can be an array of skill names
    const userId = req.user._id;
    const pattern = `/api/users/${userId}${process.env.CACHE_KEY}*`
    await scanAndDelete(pattern);
    await redis.del(`/api/auth/get-userInfo${process.env.CACHE_KEY}${userId}`);


    if (!Array.isArray(skills) || skills.length === 0) {
      return res.status(INTERNALERROR).send(
        sendError({
          status: false,
          message: "No Skills Found",
          data: null,
        })
      );
    }

    const user = await Users.findById(userId);

    // Find skills in the collection (approved or unapproved)
    let existingSkills = await Skills.find({ name: { $in: skills } });
    const existingSkillNames = existingSkills.map(skill => skill.name);

    // Identify new skills that are not in the collection
    const newSkills = skills.filter(skill => !existingSkillNames.includes(skill));

    // Add new skills to the Skills collection with adminApproval: false
    let newSkillDocs = [];
    if (newSkills.length > 0) {
      newSkillDocs = newSkills.map(skill => ({ name: skill, isActive: false }));
      const insertedSkills = await Skills.insertMany(newSkillDocs);  // Insert new skills
      newSkillDocs = insertedSkills;  // Use the inserted documents with IDs
    }

    // Merge existing skill IDs and new skill IDs
    const allSkillDocs = [...existingSkills, ...newSkillDocs];
    const skillIds = allSkillDocs.map(skill => skill._id);

    // Replace user's skills with the new array of skill IDs
    user.skills = skillIds;

    // Save the updated user document
    await user.save();

    return res.status(OK).send(
      sendSuccess({
        status: true,
        message: 'Skills added successfully.',
        data: allSkillDocs
      })
    );
  } catch (error) {
    res.status(INTERNALERROR).send(
      sendError({
        status: false,
        message: error.message,
        data: null,
      })
    );
  }
};

// @desc    Remove Skills from User
// @route   PUT api/users/skills/remove
// @access  Public
export const removeSkills = async (req, res) => {
  try {
    const { skills } = req.body; // 'skills' should be an array of skill names
    const userId = req.user._id;

    const pattern = `/api/users/${userId}${process.env.CACHE_KEY}*`
    await scanAndDelete(pattern);
    await redis.del(`/api/auth/get-userInfo${process.env.CACHE_KEY}${userId}`);

    if (!Array.isArray(skills) || skills.length === 0) {
      return res.status(400).send(
        sendError({
          status: false,
          message: "No skills provided to remove.",
          data: null,
        })
      );
    }

    const user = await Users.findById(userId);
    if (!user) {
      return res.status(404).send(
        sendError({
          status: false,
          message: "User not found.",
          data: null,
        })
      );
    }

    // Find existing skills in the Skills collection
    let existingSkills = await Skills.find({ name: { $in: skills } });
    const existingSkillIds = existingSkills.map(skill => skill._id);

    // Remove skills from the user's profile
    user.skills = user.skills.filter(skillId => !existingSkillIds.map(exstSkillId => exstSkillId.toString()).includes(skillId.toString()));
    await user.save();

    return res.status(200).send(
      sendSuccess({
        status: true,
        message: "Skills removed successfully.",
        data: user.skills,
      })
    );
  } catch (error) {
    res.status(500).send(
      sendError({
        status: false,
        message: error.message,
        data: null,
      })
    );
  }
};



export const ProfileViewController = async (req, res) => {
  // try {
  //   const { profileId } = req.params;
  //   const { viewerId } = req.body;

  //   // Ensure viewerId and profileId are not the same to avoid redundant queries
  //   if (viewerId !== profileId) {
  //     const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  //     // Use MongoDB's $setOnInsert to avoid extra updates if no changes occur
  //     const result = await profileViewSchema.findOneAndUpdate(
  //       { viewerId, profileId },
  //       { 
  //         $set: { lastViewed: new Date() }, 
  //         $setOnInsert: { lastViewed: new Date() } 
  //       },
  //       { upsert: true, new: true }
  //     ).lean(); // .lean() for faster read by excluding Mongoose overhead

  //     // Increment profile views only if a new view is recorded or an update is needed
  //     if (!result || result?.lastViewed < twentyFourHoursAgo) {
  //       await Users.findByIdAndUpdate(profileId, { $inc: { profileViews: 1 } });
  //     }
  //   }

  //   // Retrieve the updated profileViews directly from User collection
  //   const user = await Users.findById(profileId, 'profileViews').lean(); // Select only 'profileViews' field for optimization
  //   // res.json({ profileViews: user.profileViews });
  //   return res.status(OK).send(
  //     sendSuccess({
  //       status: true,
  //       message: 'Profile view recorded successfully',
  //       data: {
  //         profileViews: user.profileViews
  //       }
  //     })
  //   );
  // } catch (error) {
  //   console.error(error);
  //   // res.status(500).json({ error: 'An error occurred while recording the profile view' });
  //   return res.status(INTERNALERROR).send(
  //     sendError({
  //       status: false,
  //       message: error.message,
  //       data: null,
  //     })
  //   );
  // }

  //2nd code
  // try {
  //   const { profileId } = req.params;
  //   const { viewerId } = req.body;

  //   // Check if viewer is not the profile owner
  //   if (viewerId !== profileId) {
  //     const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  //     const result = await profileViewSchema.findOneAndUpdate(
  //       { viewerId, profileId, lastViewed: { $lt: twentyFourHoursAgo } },
  //       { lastViewed: new Date() },
  //       { upsert: true, new: true }
  //     );

  //     // If a new view was recorded or an old one was updated
  //     if (result.lastViewed > twentyFourHoursAgo) {
  //       await Users.findByIdAndUpdate(profileId, { $inc: { profileViews: 1 } });
  //     }
  //   }

  //   const user = await Users.findById(profileId);
  //   // res.json({ profileViews: user.profileViews });
  //   res.status(OK).send(
  //         sendSuccess({
  //           status: true,
  //           message: 'Profile view recorded successfully',
  //           data: {
  //             profileViews: user.profileViews
  //           }
  //         }))
  // } catch (error) {
  //   // res.status(500).json({ error: 'An error occurred while recording the profile view' });
  //   return res.status(INTERNALERROR).send(
  //         sendError({
  //           status: false,
  //           message: error.message,
  //           data: null,
  //         })
  //       )
  // }


  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { profileId } = req.params;
    const { viewerId } = req.body;

    if (viewerId === profileId) {
      const user = await Users.findById(profileId).lean();
      await session.commitTransaction();
      // return res.json({ views: user.views });
      return res.status(OK).send(
        sendSuccess({
          status: true,
          message: 'Profile view recorded successfully',
          data: {
            views: user.views
          }
        })
      )
    }

    const now = new Date();
    const twentyFourHoursAgo = new Date(now - 24 * 60 * 60 * 1000);

    // Update or insert the profile view
    const profileView = await profileViewSchema.findOneAndUpdate(
      { viewerId: viewerId, profileId: profileId },
      {
        $set: { lastViewed: now },
        $inc: { viewCount: 1 }
      },
      {
        upsert: true,
        new: true,
        session,
        setDefaultsOnInsert: true
      }
    );

    // Check if this is a new view (in the last 24 hours)
    let incrementValue = 0;
    if (profileView.lastViewed <= twentyFourHoursAgo || profileView.viewCount === 1) {
      incrementValue = 1;
    }

    // Update the user's profile view count
    const updatedUser = await Users.findByIdAndUpdate(
      profileId,
      { $inc: { views: incrementValue } },
      { new: true, session }
    );

    await session.commitTransaction();
    // res.json({ views: updatedUser.views });
    res.status(OK).send(
      sendSuccess({
        status: true,
        message: 'Profile view recorded successfully',
        data: {
          views: updatedUser.views
        }
      })
    )
  } catch (error) {
    await session.abortTransaction();
    console.error('Error recording profile view:', error);
    // res.status(500).json({ error: 'An error occurred while recording the profile view' });
    res.status(INTERNALERROR).send(
      sendError({
        status: false,
        message: error.message,
        data: null,
      })
    )
  } finally {
    session.endSession();
  }
}

export const addAppreciation = async (req, res) => {
  const appreciatingUserId = req.user._id;
  const { appreciatedUserId } = req.params;

  await redis.del(`/api/users/${appreciatedUserId}${process.env.CACHE_KEY}${appreciatingUserId}`);
  await redis.del(`/api/auth/get-userInfo${process.env.CACHE_KEY}${appreciatedUserId}`);
  const pattern = `/api/users?limit=*&pageNo=*&keyWord=*&category=*${process.env.CACHE_KEY}`
  await scanAndDelete(pattern);
  await redis.del(`/api/users/${appreciatedUserId}/appreciators${process.env.CACHE_KEY}`);
  await redis.del(`/api/users/${appreciatingUserId}/appreciated-users${process.env.CACHE_KEY}`);

  try {
    // Find or create an appreciation record for the appreciating user
    let appreciator = await AppreciationSchema.findOne({ userId: appreciatingUserId });
    if (!appreciator) {
      appreciator = new AppreciationSchema({ userId: appreciatingUserId });
    }

    // Find or create an appreciation record for the appreciated user
    let appreciated = await AppreciationSchema.findOne({ userId: appreciatedUserId });
    if (!appreciated) {
      appreciated = new AppreciationSchema({ userId: appreciatedUserId });
    }

    // Check if the user has already appreciated the other user
    if (appreciator.appreciatingTo.includes(appreciatedUserId)) {
      return res.status(INTERNALERROR).send(
        sendError({
          status: false,
          message: 'You have already appreciated this user',
          data: null,
        })
      );
    }

    // Add to appreciatedUser's `appreciatedBy` array
    appreciated.appreciatedBy.push(appreciatingUserId);

    // Add to appreciatorUser's `appreciatingTo` array
    appreciator.appreciatingTo.push(appreciatedUserId);

    // Save both records
    await appreciator.save();
    await appreciated.save();

    // Update the appreciation count in the appreciated user's profile
    await Users.findByIdAndUpdate(
      appreciatedUserId,
      { $inc: { appreciations: 1 } }, // Increment the appreciation count
      { new: true }
    );

    res.status(OK).send(
      sendSuccess({
        status: true,
        message: 'Appreciation added successfully.'
      })
    );
  } catch (error) {
    return res.status(INTERNALERROR).send(
      sendError({
        status: false,
        message: error.message,
        data: null,
      })
    );
  }
};

export const getAppreciators = async (req, res) => {
  const { userId } = req.params;

  const cacheKey = req.originalUrl + process.env.CACHE_KEY
  const cachedData = await redis.get(cacheKey);
  if (cachedData) {
    return res.status(OK).send(
      sendSuccess({
        status: true,
        message: 'Got Appreciated by Users.',
        data: JSON.parse(cachedData),
      })
    );
  }

  try {
    const appreciationRecord = await AppreciationSchema.findOne({ userId }).populate('appreciatedBy', 'name email profilePic coverPhoto profilePic firstName lastName userName');

    if (!appreciationRecord) {
      return res.status(404).json({ message: 'Appreciation record not found for the user' });
    }

    // Cache the data for 1 hour
    redis.setex(cacheKey, process.env.REDIS_SECONDS, JSON.stringify(appreciationRecord.appreciatedBy));

    res.status(OK).send(
      sendSuccess({
        status: true,
        message: 'Got Appreciated by Users.',
        data: appreciationRecord.appreciatedBy
      })
    );
  } catch (error) {
    return res.status(INTERNALERROR).send(
      sendError({
        status: false,
        message: error.message,
        data: null,
      })
    );
  }
};

export const getUsersAppreciatedBy = async (req, res) => {
  const { userId } = req.params;

  const cacheKey = req.originalUrl + process.env.CACHE_KEY
  const cachedData = await redis.get(cacheKey);
  if (cachedData) {
    return res.status(OK).send(
      sendSuccess({
        status: true,
        message: 'Got Appreciated Users.',
        data: JSON.parse(cachedData),
      })
    );
  }

  try {
    const appreciationRecord = await AppreciationSchema.findOne({ userId }).populate('appreciatingTo', 'name email profilePic coverPhoto profilePic firstName lastName userName');

    if (!appreciationRecord) {
      return res.status(NOTFOUND).send(
        sendError({
          status: false,
          message: 'Appreciation record not found for the user',
          data: null,
        })
      );
    }

    // Cache the data for 1 hour
    redis.setex(cacheKey, process.env.REDIS_SECONDS, JSON.stringify(appreciationRecord.appreciatingTo));

    res.status(OK).send(
      sendSuccess({
        status: true,
        message: 'Got Appreciated Users.',
        data: appreciationRecord.appreciatingTo
      })
    );
  } catch (error) {
    return res.status(INTERNALERROR).send(
      sendError({
        status: false,
        message: error.message,
        data: null,
      })
    );
  }
}

export const unappreciateUser = async (req, res) => {
  const appreciatingUserId = req.user._id;
  const { appreciatedUserId } = req.params;

  await redis.del(`/api/users/${appreciatedUserId}${process.env.CACHE_KEY}${appreciatingUserId}`);
  await redis.del(`/api/auth/get-userInfo${process.env.CACHE_KEY}${appreciatedUserId}`);
  const pattern = `/api/users?limit=*&pageNo=*&keyWord=*&category=*${process.env.CACHE_KEY}`
  await scanAndDelete(pattern);
  await redis.del(`/api/users/${appreciatedUserId}/appreciators${process.env.CACHE_KEY}`);
  await redis.del(`/api/users/${appreciatingUserId}/appreciated-users${process.env.CACHE_KEY}`);

  try {
    // Find the user who is unappreciating
    const appreciatingUser = await AppreciationSchema.findOne({ userId: appreciatingUserId });

    // Find the user who is being unappreciated
    const appreciatedUser = await AppreciationSchema.findOne({ userId: appreciatedUserId });

    if (!appreciatingUser || !appreciatedUser) {
      return res.status(NOTFOUND).send(
        sendError({
          status: false,
          message: 'User not found',
          data: null,
        })
      );
    }

    // Remove appreciatedUserId from appreciatingUser's appreciatingTo array
    appreciatingUser.appreciatingTo = appreciatingUser.appreciatingTo.filter(
      (id) => id.toString() !== appreciatedUserId
    );

    // Remove appreciatingUserId from appreciatedUser's appreciatedBy array
    appreciatedUser.appreciatedBy = appreciatedUser.appreciatedBy.filter(
      (id) => id.toString() !== appreciatingUserId
    );

    // Save the updated documents
    await appreciatingUser.save();
    await appreciatedUser.save();

    res.status(OK).send(
      sendSuccess({
        status: true,
        message: 'Appreciation removed successfully',
        data: null
      })
    );
  } catch (error) {
    return res.status(INTERNALERROR)
      .json(
        sendError({
          status: false,
          message: error.message,
          data: null,
        })
      );
  }
}

export const DownloadResumeController = async (req, res) => {
  res.status(OK).send(
    sendSuccess({
      status: true,
      message: 'You have the limit left to download the resume'
    })
  )
};



export const UploadResumeController = async (req, res) => {

  if (!req.file) {
    return res.status(BADREQUEST).send(sendError({
      status: false,
      message: "No file Uploaded"
    }));
  }

  const pattern = `/api/users/${req.user._id}${process.env.CACHE_KEY}*`
  await scanAndDelete(pattern);
  await redis.del(`/api/auth/get-userInfo${process.env.CACHE_KEY}${req.user._id}`);

  try {
    const updatedUser = await Users.findByIdAndUpdate(
      req.user._id, // Assume req.user is set by authentication middleware
      { resumeUrl: req.file.location },
      { new: true }
    );
    res.status(OK).send(
      sendSuccess({
        status: true,
        message: 'Resume uploaded successfully',
        data: {
          resumeUrl: updatedUser.resumeUrl
        }
      })
    )

  } catch (error) {
    console.error('Error updating user:', error);
    res.status(INTERNALERROR).json(
      sendError({
        status: false,
        message: error.message,
        data: null,
      })
    );
  }
};

export const DeleteResumeController = async (req, res) => {
  try {
    const user = await Users.findById(req.user._id);

    if (!user.resumeUrl) {
      return res.status(BADREQUEST).send(sendError({
        status: false,
        message: "No resume found for this user"
      }));
    }

    const pattern = `/api/users/${req.user._id}${process.env.CACHE_KEY}*`
    await scanAndDelete(pattern);
    await redis.del(`/api/auth/get-userInfo${process.env.CACHE_KEY}${req.user._id}`);

    // Initialize S3 client
    const s3 = new AWS.S3({
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      region: 'ap-southeast-2',
    });

    // Extract the key from the resumeUrl
    const key = user.resumeUrl.split('.com/')[1];

    // Delete the file from S3
    await s3.deleteObject({
      Bucket: 'singabucket.hiringmine',
      Key: key
    }).promise();

    // Update user in database
    const updatedUser = await Users.findByIdAndUpdate(
      req.user._id,
      { $unset: { resumeUrl: 1 } },
      { new: true }
    );

    res.status(OK).send(sendSuccess({
      status: true,
      message: 'Resume deleted successfully',
      data: {
        user: updatedUser
      }
    }));

  } catch (error) {
    console.error('Error deleting resume:', error);
    res.status(INTERNALERROR).json(sendError({
      status: false,
      message: error.message,
      data: null,
    }));
  }
};

export const ReportProfileController = async (req, res) => {
  const { profileId } = req.params;
  const { userId, reason, details } = req.body;

  try {
    // Check if the user has already reported this job
    const existingReport = await ReportSchema.findOne({ profile: profileId, reporter: userId });
    if (existingReport) {
      return res.status(BADREQUEST).send(
        sendError({
          status: false,
          message: "You have already reported this profile",
          data: null
        })
      )
    }

    // Create a new report
    const newReport = new ReportSchema({
      profile: profileId,
      reporter: userId,
      reason,
      details
    });
    await newReport.save();

    // Increment the report count on the job
    await Users.findByIdAndUpdate(profileId, { $inc: { reportCount: 1 } });

    res.status(CREATED).send(
      sendSuccess({
        status: true,
        message: "Profile reported successfully",
        data: null
      })
    );
  } catch (error) {
    res.status(INTERNALERROR).send(
      sendError({
        status: false,
        message: error.message,
        data: null
      })
    );
  }
}


export const ResumePrivacyController = async (req, res) => {
  if (!req.body.hasOwnProperty("isPublic")) {
    return res.status(BADREQUEST).send(sendError({
      status: false,
      message: MISSING_FIELDS
    }));
  }

  const pattern = `/api/users/${req.user._id}${process.env.CACHE_KEY}*`
  await scanAndDelete(pattern);
  await redis.del(`/api/auth/get-userInfo${process.env.CACHE_KEY}${req.user._id}`);

  try {
    const updatedUser = await Users.findByIdAndUpdate(
      req.user._id, // Assume req.user is set by authentication middleware
      { resumeIsPublic: req.body.isPublic },
      { new: true }
    );
    res.status(OK).send(
      sendSuccess({
        status: true,
        message: "Resume privacy updated successfully",
        data: {
          resumeUrl: updatedUser.resumeUrl,
          resumeIsPublic: updatedUser.resumeIsPublic
        }
      })
    )

  } catch (error) {
    res.status(INTERNALERROR).json(
      sendError({
        status: false,
        message: error.message,
        data: null,
      })
    );
  }
};

export const getUserResumeDownloadStats = async (req, res) => {
  try {
    const userId = req.user._id;

    const user = await Users.findById(userId);
    if (!user) {
      return res.status(NOTFOUND).send(
        sendError({
          status: false,
          message: 'User not found',
          data: null
        })
      )
    }

    return res.status(OK).send(
      sendSuccess({
        status: true,
        message: 'User download stats fetched successfully',
        data: {
          resumesDownloadedByUser: user.resumesDownloadedByUser,
          resumesDownloadedByOthers: user.resumesDownloadedByOthers,
        },
      })
    );
  } catch (error) {
    res.status(INTERNALERROR).send(
      sendError({
        status: false,
        message: error.message,
        data: null
      })
    );
  }
};

export const getLinkedinData = async (req, res) => {
  const userId = req.user._id; // Retrieve the user's ID
  // const id = '67223e6e630465353b55c1c2'
  const { linkedinUrl } = req.body;
  if (!linkedinUrl) {
    return res.status(BADREQUEST).send(
      sendError({
        status: false,
        message: 'Linkedin URL is required',
        data: null
      })
    );
  }
  try {
    console.log('Fetching linkedin data...', linkedinUrl);
    console.log(req.user);

    //check in db if already the user's data is imported from linkedin
    const user = await Users.findById(userId);
    if (user.importDataFromLinkedinPopUpShown) {
      return res.status(OK).send(
        sendError({
          status: false,
          message: 'Popup already shown and cannot try again',
        })
      );
    }
    const linkedinData = await fetchLinkedinData(false, linkedinUrl);

    console.log('Linkedin data fetched:', linkedinData);

    // const sanitizedData = sanitizeLinkedInData(linkedinData);

    // Build update object dynamically
    // Prepare user update fields
    const updateFields = {};
    const fieldMappings = {
      first_name: 'firstName',
      last_name: 'lastName',
      birth_date: 'dateOfBirth',
      gender: 'gender',
      country: 'country',
      headline: 'jobTitle',
      summary: 'description'
    };

    for (const [key, value] of Object.entries(fieldMappings)) {
      if (linkedinData[key]) {
        updateFields[value] = linkedinData[key];
      }
    }

    // Upload images to S3
    if (linkedinData.profile_pic_url) {
      const profileImageUrl = await uploadImageToS3(linkedinData.profile_pic_url, 'profile/image');
      updateFields.profilePic = profileImageUrl;
    }
    if (linkedinData.background_cover_image_url) {
      const coverImageUrl = await uploadImageToS3(linkedinData.background_cover_image_url, 'profile/cover');
      updateFields.coverPhoto = coverImageUrl;
    }

    // Delete old education and experience data
    await Promise.all([
      Education.deleteMany({ user: userId }),
      Experience.deleteMany({ user: userId })
    ]);

    // Process and insert experiences
    const experiences = linkedinData.experiences.map(exp => mapLinkedInDataToExperience(exp, userId));
    await Experience.insertMany(experiences);

    // Calculate total work experience
    updateFields.totalExperience = experiences.reduce((total, exp) => total + exp.totalDuration, 0);


    // Insert education records
    const educationRecords = linkedinData.education.map(edu => ({
      user: userId,
      institutionName: edu.school,
      degree: edu.degree_name,
      fieldOfStudy: edu.field_of_study,
      startYear: edu.starts_at?.year,
      startMonth: edu.starts_at?.month - 1,
      endYear: edu.ends_at?.year,
      endMonth: edu.ends_at?.month - 1,
      grade: edu.grade,
      currentlyProcessing: edu.ends_at === null,
    }));
    await Education.insertMany(educationRecords);

    updateFields.importDataFromLinkedin = true;
    updateFields.importDataFromLinkedinPopUpShown = true;

    // Update user data
    const updatedUser = await Users.findByIdAndUpdate(
      userId,
      { $set: updateFields },
      { new: true, runValidators: true, context: 'query' }
    );
    if (updatedUser) {
      return res.status(OK).send(
        sendSuccess({
          status: true,
          message: 'Profile updated successfully',
          data: updatedUser
        })
      );
    } else {
      return res.status(INTERNALERROR).send(
        sendError({
          status: false,
          message: 'User update failed',
          data: null
        })
      );
    }
  } catch (error) {
    console.error('Error fetching LinkedIn data:', error);
    return res.status(INTERNALERROR).send(
      sendError({
        status: false,
        message: error.message,
        data: null
      })
    );
  }
}
export const linkedinPopShown = async (req, res) => {
  const userId = req.user._id; // Retrieve the user's ID
  try {
    const user = await Users.findByIdAndUpdate(userId, { importDataFromLinkedinPopUpShown: true }, { new: true });
    if (user) {
      return res.status(OK).send(
        sendSuccess({
          status: true,
          message: 'Linkedin popup shown updated successfully',
          data: user
        })
      );
    } else {
      return res.status(INTERNALERROR).send(
        sendError({
          status: false,
          message: 'User update failed',
          data: null
        })
      );
    }
  } catch (error) {
    console.error('Error updating user:', error);
    return res.status(INTERNALERROR).send(
      sendError({
        status: false,
        message: error.message,
        data: null
      })
    );
  }
}