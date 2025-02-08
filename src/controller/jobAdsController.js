import { sendError, sendSuccess } from '../utils/responses.js';
import {
  CREATED,
  INTERNALERROR,
  OK,
  NOTFOUND,
  BADREQUEST,
  UNAUTHORIZED,
} from '../constants/httpStatus.js';
import { responseMessages } from '../constants/responseMessages.js';
import pkg from 'jsonwebtoken';
import JobAd from '../models/JobAd.js';
import HashTags from '../models/HashTags.js';
import Categories from '../models/Categories.js';
import Users from '../models/Register.js';
import fs from 'fs';
import Skills from '../models/Skills.js';
import { hash } from 'bcrypt';
import { redis } from '../app.js';
import ReportSchema from '../models/ReportSchema.js';
import { scanAndDelete } from '../utils/index.js';
import { JobApplicationTemplate } from '../templates/jobApplicationTemplate.js';
import { sendEmail } from '../utils/sendEmail.js';
import { jobPostingModel, generationConfig, jobImageModel } from '../config/gemini.js';
import path from 'path';

const { verify } = pkg;

const {
  ADD_SUCCESS_MESSAGES,
  DELETED_SUCCESS_MESSAGES,
  DELETED_UNSUCCESS_MESSAGES,
  DUPLICATE_ERROR,
  GET_SUCCESS_MESSAGES,
  GET_UNSUCCESS_MESSAGES,
  MISSING_FIELDS,
  UPDATE_SUCCESS_MESSAGES,
  UPDATE_UNSUCCESS_MESSAGES,
} = responseMessages;

// @desc    Add Job Ads
// @route   POST api/jobAds
// @access  Public
export const addJobAds = async (req, res) => {
  const pattern = `/api/jobAds/all?limit=*&pageNo=*&keyWord=*&category=*${process.env.CACHE_KEY}`
  await scanAndDelete(pattern);
  const userId = req.user._id;
  if (!userId) {
    return res.status(UNAUTHORIZED).send(sendError({ status: false, message: "User not authenticated." }));
  }
  const userCountry = req.user.Country;
  try {
    const {
      designation,
      desc,
      companyName,
      aboutCompany,
      // companyRequirements,
      featuredBenefits,
      // companySocialMedia,
      skills,
      category,
      experience,
      position,
      noOfPositions,
      payRangeStart,
      payRangeEnd,
      salaryCurrency,
      hashTags,
      jobFeseability,
      country,
      city,
      gender,
      applyEmail,
      applyPhone,
      jobType
    } = req.body;
    let jobAdDetails = {};
    if (designation && desc && userId && (applyEmail || applyPhone)) {
      const cleanedApplyPhone = applyPhone.replace(/[^\d]/g, ''); // Remove non-numeric characters
      jobAdDetails = {
        designation,
        desc,
        userId,
        companyName,
        aboutCompany,
        // companyRequirements,
        featuredBenefits,
        // companySocialMedia,
        skills,
        category,
        experience,
        position,
        noOfPositions,
        payRangeStart,
        payRangeEnd,
        salaryCurrency,
        hashTags,
        jobFeseability,
        jobType,
        country: country,
        city: city,
        gender,
        applyEmail,
        applyPhone: cleanedApplyPhone ? parseInt(cleanedApplyPhone, 10) : undefined, // Convert to number,
      };
    } else {
      return res.status(BADREQUEST).send(
        sendError({
          status: false,
          message: MISSING_FIELDS,
        })
      );
    }

    const jobAd = new JobAd(jobAdDetails);
    const result = await jobAd.save();
    const categoryInc = await Categories.findByIdAndUpdate(category, {
      $inc: { postCounts: 1 },
    });
    if (hashTags) {
      for (let i = 0; i < hashTags.length; i++) {
        const isExist = await HashTags.find({
          name: {
            $in: hashTags[i],
          },
        });
        if (isExist.length) {
          await HashTags.findByIdAndUpdate(isExist[0]._id, {
            $inc: { postCounts: 1 },
          });
        } else {
          const hashTag = new HashTags({ name: hashTags[i] });
          const hash = await hashTag.save();
          await HashTags.findByIdAndUpdate(hash._id, {
            $inc: { postCounts: 1 },
          });
        }
      }
    }
    if (skills) {
      for (let i = 0; i < skills.length; i++) {
        const isExist = await Skills.find({
          name: {
            $in: skills[i],
          },
        });
        if (isExist.length) {
          await Skills.findByIdAndUpdate(isExist[0]._id, {
            $inc: { postCounts: 1 },
          });
        } else {
          const skill = new Skills({ name: skills[i] });
          const sk = await skill.save();
          await Skills.findByIdAndUpdate(skill._id, {
            $inc: { postCounts: 1 },
          });
        }
      }
    }
    return res.status(CREATED).send(
      sendSuccess({
        status: true,
        message: ADD_SUCCESS_MESSAGES,
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

// @desc    UPDATE Job
// @route   PUT api/jobAds/:id
// @access  Public
export const updateJobAd = async (req, res) => {
  // const userCountry = req.user.Country;
  // const userId = req.user._id;
  const jobId = req.params.jobId;
  try {
    const { hashTags, skills, sponsor } = req.body;

    let job = await JobAd.findOne({ _id: jobId });

    if (job) {
      await redis.del(`/api/jobAds/${req.params.jobId}${process.env.CACHE_KEY}`);
      const pattern = `/api/jobAds/all?limit=*&pageNo=*&keyWord=*&category=*${process.env.CACHE_KEY}`
      await scanAndDelete(pattern);

      if (sponsor) {
        const updatePost = await JobAd.findByIdAndUpdate(jobId, {
          $set: {
            sponsored: true,
            sponsoredExpiry: new Date(Date.now() + (3 * 24 * 60 * 60 * 1000)), // Expiry after 3 days
          }
        }, {
          new: true,
        })
      } else {
        const updatedPost = await JobAd.findByIdAndUpdate(jobId, req.body, {
          new: true,
        });
      }
      if (hashTags) {
        // remove postCount from previous hashtags
        let previousHashTags = job.hashTags;
        if (previousHashTags) {
          for (let i = 0; i < previousHashTags.length; i++) {
            const isExist = await HashTags.find({
              name: {
                $in: previousHashTags[i],
              },
            });
            if (isExist.length) {
              await HashTags.findByIdAndUpdate(isExist[0]._id, {
                $inc: { postCounts: -1 },
              });
            }
          }
        }
        for (let i = 0; i < hashTags.length; i++) {
          const isExists = await HashTags.find({
            name: {
              $in: hashTags[i],
            },
          });
          if (isExists.length) {
            await HashTags.findByIdAndUpdate(isExists[0]._id, {
              $inc: { postCounts: 1 },
            });
          } else {
            const hashTag = new HashTags({ name: hashTags[i] });
            const hash = await hashTag.save();
            await HashTags.findByIdAndUpdate(hash._id, {
              $inc: { postCounts: 1 },
            });
          }
        }
      }
      if (skills) {
        // remove postCount from previous hashtags
        let previoussSkills = job.skills;
        if (previoussSkills) {
          for (let i = 0; i < previoussSkills.length; i++) {
            const isExist = await Skills.find({
              name: {
                $in: previoussSkills[i],
              },
            });
            if (isExist.length) {
              await Skills.findByIdAndUpdate(isExist[0]._id, {
                $inc: { postCounts: -1 },
              });
            }
          }
        }
        for (let i = 0; i < skills.length; i++) {
          const isExists = await Skills.find({
            name: {
              $in: skills[i],
            },
          });
          if (isExists.length) {
            await Skills.findByIdAndUpdate(isExists[0]._id, {
              $inc: { postCounts: 1 },
            });
          } else {
            const skill = new Skills({ name: skills[i] });
            const skil = await skill.save();
            await Skills.findByIdAndUpdate(skil._id, {
              $inc: { postCounts: 1 },
            });
          }
        }
      }

      return res.status(CREATED).send(
        sendSuccess({
          status: true,
          message: UPDATE_SUCCESS_MESSAGES,
          data: null,
        })
      );
    } else {
      return res.status(NOTFOUND).send(
        sendError({
          status: false,
          message: UPDATE_UNSUCCESS_MESSAGES,
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

// @desc    Delete JobAd
// @route   Delete api/jobAds/:id
// @access  Public
export const deleteJobAd = async (req, res) => {
  let jobId = req.params.jobId;
  try {
    let job = await JobAd.findOne({ _id: jobId }, { hashTags: 1, skills: 1 });

    if (job) {
      await redis.del(`/api/jobAds/${req.params.jobId}${process.env.CACHE_KEY}`);
      const pattern = `/api/jobAds/all?limit=*&pageNo=*&keyWord=*&category=*${process.env.CACHE_KEY}`
      await scanAndDelete(pattern);
      let previousHashTags = job.hashTags;
      let previousSkills = job.skills;
      await JobAd.deleteOne({ _id: jobId });

      if (previousHashTags) {
        for (let i = 0; i < previousHashTags.length; i++) {
          const isExist = await HashTags.find({
            name: {
              $in: previousHashTags[i],
            },
          });

          if (isExist.length) {
            await HashTags.findByIdAndUpdate(isExist[0]._id, {
              $inc: { postCounts: -1 },
            });
          }
        }
      }
      if (previousSkills) {
        for (let i = 0; i < previousSkills.length; i++) {
          const isExist = await Skills.find({
            name: {
              $in: previousSkills[i],
            },
          });

          if (isExist.length) {
            await Skills.findByIdAndUpdate(isExist[0]._id, {
              $inc: { postCounts: -1 },
            });
          }
        }
      }

      return res.status(OK).send(
        sendSuccess({
          status: true,
          message: DELETED_SUCCESS_MESSAGES,
          data: null,
        })
      );
    } else {
      return res.status(NOTFOUND).send(
        sendError({
          status: false,
          message: DELETED_UNSUCCESS_MESSAGES,
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

// @desc    Get Posts by hashTags
// @route   GET api/jobAds/all
// @access  Public
// export const getJobAdsByHashTags = async (req, res) => {
//   const tags = req.query.tags.split(',');

//   try {
//     const posts = await JobAd.find({
//       hashTags: {
//         $in: tags,
//       },
//     }).limit(req.query.limit);
//     return res.status(OK).send(
//       sendSuccess({
//         status: true,
//         message: GET_SUCCESS_MESSAGES,
//         data: posts,
//       })
//     );
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

// @desc    Get All JobAds
// @route   POST api/getJobAds/all
// @access  Public

// export const getJobAds = async (req, res) => {
//   console.log(req.originalUrl, "===>>>req.originalUrl")
//   const cacheKey = req.originalUrl;
//   const cachedData = await redis.get(cacheKey);
//   if (false) {
//     return res.status(OK).send(
//       sendSuccess({
//         status: true,
//         message: GET_SUCCESS_MESSAGES,
//         ...JSON.parse(cachedData)
//       })
//     );
//     // return res.send({
//     //   ...JSON.parse(cachedData)
//     // })
//   } else {
//     try {
//       let query = {};
//       const { pageNo, limit, filteration, tags, skills, category, views, country, salary, city, experience, keyWord } = req.query;
//       let { days = 365 } = req.query;
//       days = Math.max(...days.toString().split(',').map((d) => +d))
//       var today = new Date();
//       today.setDate(today.getDate() - days);
//       console.log("today", today)
//       const keyWordd = keyWord?.trim();
//       console.log(keyWordd, "===>>>keyWordd")
//       if (filteration) {
//         query = {
//           jobFeseability: {
//             $in: filteration && filteration
//               .split(',')
//               ?.filter((filt) => ['Onsite', 'Remote', 'Hybrid'].includes(filt))
//               .length
//               ? filteration
//                 .split(',')
//                 ?.filter((filt) =>
//                   ['Onsite', 'Remote', 'Hybrid'].includes(filt)
//                 )
//               : ['Onsite', 'Remote', 'Hybrid'],
//           },
//           position: {
//             $in: filteration && filteration
//               .split(',')
//               ?.filter((filt) =>
//                 [
//                   'Mid-Level',
//                   'Senior-Level',
//                   'Associate',
//                   'Internship',
//                   'Fresher',
//                 ].includes(filt)
//               ).length
//               ? filteration
//                 .split(',')
//                 ?.filter((filt) =>
//                   [
//                     'Mid-Level',
//                     'Senior-Level',
//                     'Associate',
//                     'Internship',
//                     'Fresher',
//                   ].includes(filt)
//                 )
//               : ['Mid-Level',
//                 'Senior-Level',
//                 'Associate',
//                 'Internship',
//                 'Fresher',],
//           },
//           jobType: {
//             $in: filteration && filteration
//               .split(',')
//               ?.filter((filt) =>
//                 [
//                   'Full-Time',
//                   'Part-Time',
//                   'Contract'
//                 ].includes(filt)
//               ).length
//               ? filteration
//                 .split(',')
//                 ?.filter((filt) =>
//                   [
//                     'Full-Time',
//                     'Part-Time',
//                     'Contract'
//                   ].includes(filt)
//                 )
//               : ['Full-Time',
//                 'Part-Time',
//                 'Contract'],
//           },
//         };

//         // query = {
//         //   // jobFeseability: { $in: filteration.split(',') },
//         //   position: { $in: filteration.split(',') },
//         // };
//       }
//       if (tags) {
//         console.log(tags, '=>>tags')
//         query = {
//           ...query,
//           hashTags: {
//             $in: tags.split(',')
//           }
//         }
//       }
//       if (skills) {
//         console.log(skills, '=>>skills')
//         query = {
//           ...query,
//           skills: {
//             $in: skills.split(',')
//           }
//         }
//       }
//       if (category) {
//         console.log(category, '=>>category')
//         if (typeof category != 'string' && category.length > 1) {
//           const category2 = [...category[0].split(','), category[1]];
//           query = {
//             ...query,
//             $or: category2.filter(cat => cat != "").map(cat => ({ category: cat }))
//           }
//         } else {
//           query = {
//             ...query,
//             category: {
//               $in: category.split(',')
//             }
//           }
//         }
//       }
//       if (country) {
//         console.log(country, '=>>country')
//         query = {
//           ...query,
//           country: { $regex: country, $options: 'i' }
//         }
//       }
//       if (city) {
//         console.log(city, '=>>city')
//         query = {
//           ...query,
//           city: { $regex: city, $options: 'i' }
//         }
//       }
//       if (salary) {
//         console.log(salary, '=>>salary')

//         const rangeArr = [];
//         salary.split(",").forEach(_salaryRange => {
//           const _salary = _salaryRange.split("-")
//           rangeArr.push(_salary[0])
//           rangeArr.push(_salary[1])
//         })
//         const min = Math.min(...rangeArr);
//         const max = Math.max(...rangeArr);
//         query = {
//           ...query,
//           // payRangeStart: { $gte: min },
//           // payRangeEnd: { $lte: max }
//           $or: [
//             { payRangeStart: { $lte: min }, payRangeEnd: { $gte: min } }, // min of the user's range is before or at the min of the query range
//             { payRangeStart: { $lte: max }, payRangeEnd: { $gte: max } }, // max of the user's range is after or at the max of the query range
//             { payRangeStart: { $gte: min }, payRangeEnd: { $lte: max } } // User's range is completely within the query range
//           ]
//         }
//       }
//       if (keyWordd) {
//         console.log(keyWordd, "===>>>keyWordd")
//         query = {
//           ...query,
//           $or: [
//             { designation: { $regex: `${keyWordd}`, $options: 'i' } },
//             { desc: { $regex: `${keyWordd}`, $options: 'i' } },
//           ],
//         }
//       }
//       if (experience) {
//         console.log(experience, '=>>experience')
//         // query = {
//         //   ...query,
//         //   experience: { $in: experience.split(',') }
//         // }
//         const rangeArr = [];
//         experience.split(",").forEach(_experienceRange => {
//           const [_min, _max] = _experienceRange.split("-").map(parseFloat);
//           rangeArr.push(_min);
//           rangeArr.push(_max);
//         });

//         const min = Math.min(...rangeArr);
//         const max = Math.max(...rangeArr);

//         query = {
//           ...query,
//           experience: {
//             $regex: new RegExp(`^[0-9]*(\\.?[0-9]+)?\\s*-\\s*[0-9]*(\\.?[0-9]+)?\\s*years$`, 'i'),
//             $gte: min,
//             $lte: max,
//           },
//         };
//       }
//       console.log(query, '=>>query2');
//       var skip = limit * (pageNo - 1);
//       const jobAdsCount = await JobAd.count(query);
//       let jobAds;
//       console.log(JSON.stringify(query), "==>> query")
//       if (views) {
//         const sponsoredAds = await JobAd.find({
//           ...query,
//           sponsored: true,
//           // sponsoredExpiry: { $gte: new Date() }, // Check for not expired
//           createdAt: { $gte: today }
//         })
//           .skip(skip)
//           .limit(limit)
//           .sort('-views')
//           // .populate('talentCategory', { name: 1 })
//           // .populate('talentSubCategory', { name: 1 })
//           // .populate('userId', {
//           //   FirstName: 1,
//           //   LastName: 1,
//           //   'Config.ProfilePic': 1,
//           // })
//           .populate('category');
//         const regularAds = await JobAd.find({
//           ...query,
//           $or: [
//             { sponsored: false }, // Ads that are not sponsored
//             { sponsored: { $exists: false } }, // Ads that don't have the sponsored property
//           ],
//           createdAt: { $gte: today }
//         })
//           .skip(skip)
//           .limit(limit)
//           .sort('-views')
//           // .populate('talentCategory', { name: 1 })
//           // .populate('talentSubCategory', { name: 1 })
//           // .populate('userId', {
//           //   FirstName: 1,
//           //   LastName: 1,
//           //   'Config.ProfilePic': 1,
//           // })
//           .populate('category');

//         jobAds = [...sponsoredAds, ...regularAds];
//       } else {
//         console.log("today", today)
//         const sponsoredAds = await JobAd.find({
//           ...query,
//           sponsored: true,
//           // sponsoredExpiry: { $gte: new Date() }, // Check for not expired
//           createdAt: { $gte: today }
//         })
//           .skip(skip)
//           .limit(limit)
//           .sort('-createdAt')
//           // .populate('talentCategory', { name: 1 })
//           // .populate('talentSubCategory', { name: 1 })
//           // .populate('userId', {
//           //   FirstName: 1,
//           //   LastName: 1,
//           //   'Config.ProfilePic': 1,
//           // })
//           .populate('category');
//         const regularAds = await JobAd.find({
//           ...query,
//           $or: [
//             { sponsored: false }, // Ads that are not sponsored
//             { sponsored: { $exists: false } }, // Ads that don't have the sponsored property
//           ],
//           createdAt: { $gte: today }
//         })
//           .skip(skip)
//           .limit(limit)
//           .sort('-createdAt')
//           // .populate('talentCategory', { name: 1 })
//           // .populate('talentSubCategory', { name: 1 })
//           // .populate('userId', {
//           //   FirstName: 1,
//           //   LastName: 1,
//           //   'Config.ProfilePic': 1,
//           // })
//           .populate('category');

//         jobAds = [...sponsoredAds, ...regularAds];
//       }


//       // for (let i = 0; i < posts.length; i++) {
//       //   const tags = await Promise.all(
//       //     posts[i].tags.map((tag) => {
//       //       return HashTags.find({
//       //         _id: tag,
//       //         isActive: true,
//       //       });
//       //     })
//       //   );
//       //   posts = { ...posts[i]._doc, tags };
//       // }

//       // console.log(jobAds, '==>> jobAds');

//       const result = jobAds.map(
//         ({
//           _id,
//           designation,
//           desc,
//           companyName,
//           aboutCompany,
//           // companyRequirements,
//           featuredBenefits,
//           // companySocialMedia,
//           skills,
//           category,
//           experience,
//           position,
//           noOfPositions,
//           payRangeStart,
//           payRangeEnd,
//           salaryCurrency,
//           jobFeseability,
//           jobType,
//           // userId,
//           views,
//           // likes,
//           // dislikes,
//           // shares,
//           hashTags,
//           country,
//           city,
//           isActive,
//           createdAt,
//           updatedAt,
//           gender,
//           applyEmail,
//           applyPhone,
//           sponsored
//         }) => ({
//           views,
//           // likes,
//           // dislikes,
//           companyName,
//           aboutCompany,
//           // companyRequirements,
//           featuredBenefits,
//           // companySocialMedia,
//           skills,
//           category,
//           experience,
//           position,
//           noOfPositions,
//           payRangeStart,
//           payRangeEnd,
//           salaryCurrency,
//           jobFeseability,
//           jobType,
//           // likeCount: likes.length,
//           // disLikeCount: dislikes.length,
//           // shareCount: shares.length,
//           // isLike:
//           //   likes.filter((l) => l === req?.user?._id).length > 0 ? true : false,
//           // isDislike:
//           //   dislikes.filter((l) => l === req?.user?._id).length > 0
//           //     ? true
//           //     : false,
//           // isShare:
//           //   shares.filter((l) => l === req?.user?._id).length > 0 ? true : false,
//           _id,
//           designation,
//           desc,
//           // userId,
//           hashTags,
//           country,
//           city,
//           isActive,
//           createdAt,
//           updatedAt,
//           gender,
//           applyEmail,
//           applyPhone,
//           sponsored
//         })
//       );

//       redis.setex(cacheKey, process.env.REDIS_SECONDS, JSON.stringify({
//         data: result,
//         count: jobAdsCount
//       }));

//       console.log("==>> going to send by api hit")

//       return res.status(OK).send(
//         sendSuccess({
//           status: true,
//           message: GET_SUCCESS_MESSAGES,
//           data: result,
//           count: jobAdsCount,
//         })
//       );
//     } catch (error) {
//       console.log("error", error)
//       return res.status(INTERNALERROR).send(
//         sendError({
//           status: false,
//           message: error.message,
//           data: null,
//         })
//       );
//     }
//   }

// };

export const getJobAds = async (req, res) => {
  console.log(req.user?._id, "==>> req.user._id")
  try {
    const cacheKey = req.originalUrl + process.env.CACHE_KEY;
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      return res.status(OK).send(
        sendSuccess({
          status: true,
          message: GET_SUCCESS_MESSAGES,
          ...JSON.parse(cachedData)
        })
      );
      // return res.send({
      //   ...JSON.parse(cachedData)
      // })
    }
    let query = {};


    // Add this condition for isVerified
    query.isVerified = {
      $in: [true, null, undefined], // This checks for jobs where isVerified is either true, null, or undefined
    };


    // If the user is logged in, allow them to see their own unverified jobs
    if (req.user?._id) {
      query = {};
      query.$or = [
        { isVerified: { $in: [true, null, undefined] } }, // Default verified job condition
        { userId: req.user._id } // Show all jobs posted by the logged-in user
      ];
    }


    const { pageNo = 1, limit = 10, filteration, tags, skills, category, views, country, salary, city, experience, keyWord, isPending } = req.query;

    const skip = (pageNo - 1) * limit;



    if (isPending == true) {
      query = {}
    }

    // Setting the 'days' for createdAt filter
    let { days = 365 } = req.query;
    days = Math.max(...days.toString().split(',').map((d) => +d));
    var today = new Date();
    today.setDate(today.getDate() - days);

    const keyWordd = keyWord?.trim();

    if (keyWordd) {
      query = {
        ...query,
        $or: [
          { designation: { $regex: keyWordd, $options: 'i' } },
          { desc: { $regex: keyWordd, $options: 'i' } },
        ],
      };
    }

    if (filteration) {
      query = {
        ...query,
        jobFeseability: {
          $in: filteration && filteration
            .split(',')
            ?.filter((filt) => ['Onsite', 'Remote', 'Hybrid'].includes(filt))
            .length
            ? filteration
              .split(',')
              ?.filter((filt) =>
                ['Onsite', 'Remote', 'Hybrid'].includes(filt)
              )
            : ['Onsite', 'Remote', 'Hybrid'],
        },
        position: {
          $in: filteration && filteration
            .split(',')
            ?.filter((filt) =>
              [
                'Mid-Level',
                'Senior-Level',
                'Associate',
                'Internship',
                'Fresher',
              ].includes(filt)
            ).length
            ? filteration
              .split(',')
              ?.filter((filt) =>
                [
                  'Mid-Level',
                  'Senior-Level',
                  'Associate',
                  'Internship',
                  'Fresher',
                ].includes(filt)
              )
            : ['Mid-Level',
              'Senior-Level',
              'Associate',
              'Internship',
              'Fresher',],
        },
        jobType: {
          $in: filteration && filteration
            .split(',')
            ?.filter((filt) =>
              [
                'Full-Time',
                'Part-Time',
                'Contract'
              ].includes(filt)
            ).length
            ? filteration
              .split(',')
              ?.filter((filt) =>
                [
                  'Full-Time',
                  'Part-Time',
                  'Contract'
                ].includes(filt)
              )
            : ['Full-Time',
              'Part-Time',
              'Contract'],
        },
      };
    }

    if (tags) {
      query = {
        ...query,
        hashTags: {
          $in: tags.split(',')
        }
      };
    }

    if (skills) {
      query = {
        ...query,
        skills: {
          $in: skills.split(',')
        }
      };
    }

    if (category) {
      if (typeof category != 'string' && category.length > 1) {
        const category2 = [...category[0].split(','), category[1]];
        query = {
          ...query,
          $or: category2.filter(cat => cat != "").map(cat => ({ category: cat }))
        };
      } else {
        query = {
          ...query,
          category: {
            $in: category.split(',')
          }
        };
      }
    }

    if (country) {
      query = {
        ...query,
        country: { $regex: country, $options: 'i' }
      };
    }

    if (city) {
      query = {
        ...query,
        city: { $regex: city, $options: 'i' }
      };
    }

    if (salary) {
      const rangeArr = [];
      salary.split(",").forEach(_salaryRange => {
        const _salary = _salaryRange.split("-");
        rangeArr.push(_salary[0]);
        rangeArr.push(_salary[1]);
      });
      const min = Math.min(...rangeArr);
      const max = Math.max(...rangeArr);

      query = {
        ...query,
        $and: [
          {
            $or: [
              { payRangeStart: { $lte: min }, payRangeEnd: { $gte: min } },
              { payRangeStart: { $lte: max }, payRangeEnd: { $gte: max } },
              { payRangeStart: { $gte: min }, payRangeEnd: { $lte: max } }
            ]
          },
          { ...query }
        ]
      };
    }

    if (experience) {
      const rangeArr = [];
      experience.split(",").forEach(_experienceRange => {
        const [_min, _max] = _experienceRange.split("-").map(parseFloat);
        rangeArr.push(_min);
        rangeArr.push(_max);
      });

      const min = Math.min(...rangeArr);
      const max = Math.max(...rangeArr);

      query = {
        ...query,
        experience: {
          $regex: new RegExp(`^[0-9]*(\\.?[0-9]+)?\\s*-\\s*[0-9]*(\\.?[0-9]+)?\\s*years$`, 'i'),
          $gte: min,
          $lte: max,
        },
      };
    }

    query.createdAt = { $gte: today };

    console.log(query, '=>>query');

    const jobAds = await JobAd.find(query)
      .skip(skip)
      .limit(parseInt(limit))
      .sort('-createdAt')
      .populate('category')
      .populate('userId', 'firstName lastName userName'); // Populate user details


    const result = jobAds.map(
      ({
        _id,
        designation,
        desc,
        isVerified,
        isHidden,
        companyName,
        aboutCompany,
        featuredBenefits,
        skills,
        category,
        experience,
        position,
        noOfPositions,
        payRangeStart,
        payRangeEnd,
        salaryCurrency,
        jobFeseability,
        jobType,
        views,
        hashTags,
        country,
        city,
        isActive,
        createdAt,
        updatedAt,
        gender,
        applyEmail,
        applyPhone,
        sponsored,
        userId, // Include the userId here
      }) => ({
        views,
        companyName,
        aboutCompany,
        featuredBenefits,
        skills,
        category,
        experience,
        position,
        noOfPositions,
        payRangeStart,
        payRangeEnd,
        salaryCurrency,
        jobFeseability,
        jobType,
        _id,
        designation,
        desc,
        isVerified,
        isHidden,
        hashTags,
        country,
        city,
        isActive,
        createdAt,
        updatedAt,
        gender,
        applyEmail,
        applyPhone,
        sponsored,
        user: userId ? { // Check if userId exists
          userId: userId._id, // Include userId
          firstName: userId.firstName, // Include firstName
          lastName: userId.lastName, // Include lastName
          userName: userId.userName // Include userName
        } : null, // Set to null if userId is not present
      })
    );

    redis.setex(cacheKey, process.env.REDIS_SECONDS, JSON.stringify({
      data: result,
      count: jobAds.length
    }));

    return res.status(200).send({
      status: true,
      message: "Success",
      data: result,
      count: jobAds.length,
    });

  } catch (error) {
    return res.status(500).send({
      status: false,
      message: error.message,
      data: null,
    });
  }
};

export const getRecommendedJobs = async (req, res) => {
  console.log(req.originalUrl, "===>>>req.originalUrl")
  try {
    let query = {};

    const {
      pageNo = 1,
      limit = 10,
      skills,
    } = req.query;

    const skip = (pageNo - 1) * limit;

    // Filtering by skills
    if (skills) {
      const skillsArray = skills.split(',');

      query = {
        ...query,
        $or: [
          { skills: { $in: skillsArray } }, // Check if skills match the skills array in the database
          { desc: { $regex: skillsArray.join('|'), $options: 'i' } }, // Check if skills appear in the description
          { designation: { $regex: skillsArray.join('|'), $options: 'i' } } // Check if skills appear in the designation
        ]
      };
    }
    console.log(query, '=>>query');

    // Fetching recommended jobs
    const recommendedJobs = await JobAd.find(query)
      .skip(skip)
      .limit(parseInt(limit))
      .sort("-createdAt")
      .populate("category")
      .populate("userId", "firstName lastName userName");

    // Formatting the results
    const result = recommendedJobs.map(
      ({
        _id,
        designation,
        desc,
        isVerified,
        companyName,
        aboutCompany,
        featuredBenefits,
        skills,
        category,
        experience,
        position,
        noOfPositions,
        payRangeStart,
        payRangeEnd,
        salaryCurrency,
        jobFeseability,
        jobType,
        hashTags,
        country,
        city,
        isActive,
        createdAt,
        updatedAt,
        gender,
        applyEmail,
        applyPhone,
        sponsored,
        userId,
      }) => ({
        _id,
        designation,
        desc,
        isVerified,
        companyName,
        aboutCompany,
        featuredBenefits,
        skills,
        category,
        experience,
        position,
        noOfPositions,
        payRangeStart,
        payRangeEnd,
        salaryCurrency,
        jobFeseability,
        jobType,
        hashTags,
        country,
        city,
        isActive,
        createdAt,
        updatedAt,
        gender,
        applyEmail,
        applyPhone,
        sponsored,
        user: userId
          ? {
            userId: userId._id,
            firstName: userId.firstName,
            lastName: userId.lastName,
            userName: userId.userName,
          }
          : null,
      })
    );

    // Sending the response
    return res.status(200).send({
      status: true,
      message: "Recommended jobs fetched successfully",
      data: result,
      count: recommendedJobs.length,
    });
  } catch (error) {
    return res.status(500).send({
      status: false,
      message: error.message,
      data: null,
    });
  }
};



// @desc    Get Post By Id
// @route   POST api/posts/:id
// @access  Public
export const getJobAd = async (req, res, next) => {
  const cacheKey = req.originalUrl + process.env.CACHE_KEY;
  const cachedData = await redis.get(cacheKey);
  if (cachedData) {
    return res.status(OK).send(
      sendSuccess({
        status: true,
        message: GET_SUCCESS_MESSAGES,
        ...JSON.parse(cachedData)
      })
    );
  } else {
    try {
      let id = req.params.id;
      const jobAd = await JobAd.findOne({ _id: id })
        // .populate('talentCategory', { name: 1 })
        // .populate('talentSubCategory', { name: 1 })
        // .populate('userId', {
        //   FirstName: 1,
        //   LastName: 1,
        //   'Config.ProfilePic': 1,
        // })
        .populate('category')
        .populate('userId', 'firstName lastName userName'); // Populate user details
      if (jobAd) {
        const {
          views,
          // likes,
          // dislikes,
          companyName,
          aboutCompany,
          // companyRequirements,
          featuredBenefits,
          // companySocialMedia,
          skills,
          category,
          experience,
          position,
          noOfPositions,
          payRangeStart,
          payRangeEnd,
          salaryCurrency,
          jobFeseability,
          jobType,
          // likeCount: likes.length,
          // disLikeCount: dislikes.length,
          // shareCount: shares.length,
          // isLike:
          //   likes.filter((l) => l === req?.user?._id).length > 0 ? true : false,
          // isDislike:
          //   dislikes.filter((l) => l === req?.user?._id).length > 0
          //     ? true
          //     : false,
          // isShare:
          //   shares.filter((l) => l === req?.user?._id).length > 0 ? true : false,
          _id,
          designation,
          desc,
          userId,
          hashTags,
          country,
          city,
          isActive,
          createdAt,
          updatedAt,
          gender,
          applyEmail,
          applyPhone,
        } = jobAd;
        const result = {
          views,
          // likes,
          // dislikes,
          companyName,
          aboutCompany,
          // companyRequirements,
          featuredBenefits,
          // companySocialMedia,
          skills,
          category,
          experience,
          position,
          noOfPositions,
          payRangeStart,
          payRangeEnd,
          salaryCurrency,
          jobFeseability,
          jobType,
          // likeCount: likes.length,
          // disLikeCount: dislikes.length,
          // shareCount: shares.length,
          // isLike:
          //   likes.filter((l) => l === req?.user?._id).length > 0 ? true : false,
          // isDislike:
          //   dislikes.filter((l) => l === req?.user?._id).length > 0
          //     ? true
          //     : false,
          // isShare:
          //   shares.filter((l) => l === req?.user?._id).length > 0 ? true : false,
          _id,
          designation,
          desc,
          user: userId ? { // Check if userId exists
            userId: userId._id, // Include userId
            firstName: userId.firstName, // Include firstName
            lastName: userId.lastName, // Include lastName
            userName: userId.userName // Include userName
          } : null, // Set to null if userId is not present,
          hashTags,
          country,
          city,
          isActive,
          createdAt,
          updatedAt,
          gender,
          applyEmail,
          applyPhone,
        };

        redis.setex(cacheKey, process.env.REDIS_SECONDS, JSON.stringify({
          data: result,
        }));

        return res.status(OK).send(
          sendSuccess({
            status: true,
            message: GET_SUCCESS_MESSAGES,
            data: result,
          })
        );
      } else {
        return res.status(NOTFOUND).send(
          sendError({
            status: false,
            message: GET_UNSUCCESS_MESSAGES,
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
  }
};

// @desc    Get Recent Posts By Filters
// @route   GET api/posts
//  @access  Public

// export const getRecentPosts = async (req, res) => {
//   const { days, count, likes, views, date, pageNo, limit, userId } = req.query;
//   var skip = limit * (pageNo - 1);

//   try {
//     let posts = [];
//     let postsCount = 0;
//     var today = new Date();
//     today.setDate(today.getDate() - days);

//     let query = '';
//     if (userId) {
//       query = { createdAt: { $gte: today }, userId: userId };
//       postsCount = await Post.count(query).limit(count);
//     } else {
//       query = { createdAt: { $gte: today } };
//       postsCount = await Post.count(query).limit(count);
//     }

//     if ((pageNo && !limit) || (!pageNo && limit)) {
//       return res.status(INTERNALERROR).send(
//         sendError({
//           status: false,
//           message: 'invalid pagination parameters',
//           data: null,
//         })
//       );
//     }

//     if (views) {
//       if (pageNo && limit) {
//         posts = await Post.find(query)
//           .sort('-views')
//           .sort({ title: 1 })
//           .skip(skip)
//           .limit(limit)
//           .populate('talentCategory', { name: 1 })
//           .populate('talentSubCategory', { name: 1 })
//           .populate('userId', {
//             FirstName: 1,
//             LastName: 1,
//             'Config.ProfilePic': 1,
//           });
//       } else {
//         posts = await Post.find(query)
//           .sort('-views')
//           .sort({ title: 1 })
//           .limit(count)
//           .populate('talentCategory', { name: 1 })
//           .populate('talentSubCategory', { name: 1 })
//           .populate('userId', {
//             FirstName: 1,
//             LastName: 1,
//             'Config.ProfilePic': 1,
//           });
//       }
//     } else if (date) {
//       if (pageNo && limit) {
//         posts = await Post.find(query)
//           .sort('-createdAt')
//           .skip(skip)
//           .limit(limit)
//           .populate('talentCategory', { name: 1 })
//           .populate('talentSubCategory', { name: 1 })
//           .populate('userId', {
//             FirstName: 1,
//             LastName: 1,
//             'Config.ProfilePic': 1,
//           });
//       } else {
//         posts = await Post.find(query)
//           .sort('-createdAt')
//           .limit(count)
//           .populate('talentCategory', { name: 1 })
//           .populate('talentSubCategory', { name: 1 })
//           .populate('userId', {
//             FirstName: 1,
//             LastName: 1,
//             'Config.ProfilePic': 1,
//           });
//       }
//     } else {
//       if (pageNo && limit) {
//         posts = await Post.find(query)
//           .sort({ title: 1 })
//           .skip(skip)
//           .limit(limit)
//           .populate('talentCategory', { name: 1 })
//           .populate('talentSubCategory', { name: 1 })
//           .populate('userId', {
//             FirstName: 1,
//             LastName: 1,
//             'Config.ProfilePic': 1,
//           });
//       } else {
//         posts = await Post.find(query)
//           .sort({ title: 1 })
//           .limit(count)
//           .populate('talentCategory', { name: 1 })
//           .populate('talentSubCategory', { name: 1 })
//           .populate('userId', {
//             FirstName: 1,
//             LastName: 1,
//             'Config.ProfilePic': 1,
//           });
//       }
//     }

//     let result = posts.map(
//       ({
//         _id,
//         title,
//         desc,
//         userId,
//         type,
//         images,
//         videoImageUrl,
//         videoUrl,
//         videoType,
//         audioImageUrl,
//         audioUrl,
//         audioType,
//         views,
//         likes,
//         dislikes,
//         shares,
//         hashTags,
//         duration,
//         country,
//         isActive,
//         createdAt,
//         updatedAt,
//         talentCategory,
//         talentSubCategory,
//       }) => ({
//         _id,
//         title,
//         desc,
//         userId,
//         type,
//         images,
//         videoImageUrl,
//         videoUrl,
//         videoType,
//         audioImageUrl,
//         audioUrl,
//         audioType,
//         views,
//         likeCount: likes.length,
//         disLikeCount: dislikes.length,
//         shareCount: shares.length,
//         isLike:
//           likes.filter((id) => id === req?.user?._id).length > 0 ? true : false,
//         isDislike:
//           dislikes.filter((id) => id === req?.user?._id).length > 0
//             ? true
//             : false,
//         isShare:
//           shares.filter((id) => id === req?.user?._id).length > 0
//             ? true
//             : false,
//         hashTags,
//         duration,
//         country,
//         isActive,
//         createdAt,
//         updatedAt,
//         talentCategory,
//         talentSubCategory,
//       })
//     );

//     if (likes) {
//       result.sort(function (a, b) {
//         return b.likeCount - a.likeCount;
//       });
//     }

//     return res.status(OK).send(
//       sendSuccess({
//         status: true,
//         message: GET_SUCCESS_MESSAGES,
//         data: result,
//         count: postsCount,
//       })
//     );
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

// @desc    Get Posts By Category
// @route   GET api/posts/category
//  @access  Public
// export const getPostsByCategory = async (req, res) => {
//   const { days, count, categoryId, likes, views, date, pageNo, limit, userId } =
//     req.query;
//   var skip = limit * (pageNo - 1);
//   try {
//     var today = new Date();
//     today.setDate(today.getDate() - days);

//     let categoryIdArr = categoryId.includes(',')
//       ? categoryId.split(',')
//       : [categoryId];
//     let postCategories = [];

//     for (let l = 0; l < categoryIdArr.length; l++) {
//       let param = categoryIdArr[l];
//       let posts = [];
//       let postsCount = 0;
//       let query = '';

//       if (userId) {
//         query = {
//           createdAt: { $gte: today },
//           talentCategory: { $in: categoryIdArr[l] },
//           userId: userId,
//         };
//         postsCount = await Post.count(query).limit(count);
//       } else {
//         query = {
//           createdAt: { $gte: today },
//           talentCategory: { $in: categoryIdArr[l] },
//         };
//         postsCount = await Post.count(query).count(count);
//       }

//       if ((pageNo && !limit) || (!pageNo && limit)) {
//         return res.status(INTERNALERROR).send(
//           sendError({
//             status: false,
//             message: 'invalid pagination parameters',
//             data: null,
//           })
//         );
//       }

//       if (views) {
//         if (pageNo && limit) {
//           posts = await Post.find(query)
//             .sort('-views')
//             .skip(skip)
//             .limit(limit)
//             .populate('talentCategory', { name: 1 })
//             .populate('talentSubCategory', { name: 1 })
//             .populate('userId', {
//               FirstName: 1,
//               LastName: 1,
//               'Config.ProfilePic': 1,
//             });
//         } else {
//           posts = await Post.find(query)
//             .sort('-views')
//             .limit(count)
//             .populate('talentCategory', { name: 1 })
//             .populate('talentSubCategory', { name: 1 })
//             .populate('userId', {
//               FirstName: 1,
//               LastName: 1,
//               'Config.ProfilePic': 1,
//             });
//         }
//       } else if (date) {
//         if (pageNo && limit) {
//           posts = await Post.find(query)
//             .sort('-createdAt')
//             .skip(skip)
//             .limit(limit)
//             .populate('talentCategory', { name: 1 })
//             .populate('talentSubCategory', { name: 1 })
//             .populate('userId', {
//               FirstName: 1,
//               LastName: 1,
//               'Config.ProfilePic': 1,
//             });
//         } else {
//           posts = await Post.find(query)
//             .sort('-createdAt')
//             .limit(count)
//             .populate('talentCategory', { name: 1 })
//             .populate('talentSubCategory', { name: 1 })
//             .populate('userId', {
//               FirstName: 1,
//               LastName: 1,
//               'Config.ProfilePic': 1,
//             });
//         }
//       } else {
//         if (pageNo && limit) {
//           posts = await Post.find(query)
//             .sort({ title: 1 })
//             .skip(skip)
//             .limit(limit)
//             .populate('talentCategory', { name: 1 })
//             .populate('talentSubCategory', { name: 1 })
//             .populate('userId', {
//               FirstName: 1,
//               LastName: 1,
//               'Config.ProfilePic': 1,
//             });
//         } else {
//           posts = await Post.find(query)
//             .sort({ title: 1 })
//             .limit(count)
//             .populate('talentCategory', { name: 1 })
//             .populate('talentSubCategory', { name: 1 })
//             .populate('userId', {
//               FirstName: 1,
//               LastName: 1,
//               'Config.ProfilePic': 1,
//             });
//         }
//       }

//       let result = posts.map(
//         ({
//           _id,
//           title,
//           desc,
//           userId,
//           type,
//           images,
//           videoImageUrl,
//           videoUrl,
//           videoType,
//           audioImageUrl,
//           audioUrl,
//           audioType,
//           views,
//           likes,
//           dislikes,
//           shares,
//           hashTags,
//           duration,
//           country,
//           isActive,
//           createdAt,
//           updatedAt,
//           talentCategory,
//           talentSubCategory,
//         }) => ({
//           _id,
//           title,
//           desc,
//           userId,
//           type,
//           images,
//           videoImageUrl,
//           videoUrl,
//           videoType,
//           audioImageUrl,
//           audioUrl,
//           audioType,
//           views,
//           likeCount: likes.length,
//           disLikeCount: dislikes.length,
//           shareCount: shares.length,
//           isLike:
//             likes.filter((id) => id === req?.user?._id).length > 0
//               ? true
//               : false,
//           isDislike:
//             dislikes.filter((id) => id === req?.user?._id).length > 0
//               ? true
//               : false,
//           isShare:
//             shares.filter((id) => id === req?.user?._id).length > 0
//               ? true
//               : false,
//           hashTags,
//           duration,
//           country,
//           isActive,
//           createdAt,
//           updatedAt,
//           talentCategory,
//           talentSubCategory,
//         })
//       );

//       if (likes) {
//         result.sort(function (a, b) {
//           return b.likeCount - a.likeCount;
//         });
//       }
//       let obj = {};
//       obj[param] = { posts: result, count: postsCount };
//       postCategories.push(obj);
//     }

//     return res.status(OK).send(
//       sendSuccess({
//         status: true,
//         message: GET_SUCCESS_MESSAGES,
//         data: postCategories,
//       })
//     );
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

// @desc    Get Posts By Sub Category
// @route   GET api/posts/subCategory
//  @access  Public
// export const getPostsBySubCategory = async (req, res) => {
//   const {
//     days,
//     count,
//     subCategoryId,
//     likes,
//     views,
//     date,
//     pageNo,
//     limit,
//     userId,
//   } = req.query;
//   try {
//     var today = new Date();
//     today.setDate(today.getDate() - days);

//     let subCategoryIdArr = subCategoryId.includes(',')
//       ? subCategoryId.split(',')
//       : [subCategoryId];
//     let postCategories = [];

//     for (let l = 0; l < subCategoryIdArr.length; l++) {
//       let posts = [];
//       let postsCount = 0;
//       let param = subCategoryIdArr[l];

//       let query = '';
//       if (userId) {
//         query = {
//           createdAt: { $gte: today },
//           talentSubCategory: { $in: subCategoryIdArr[l] },
//           userId: userId,
//         };
//         postsCount = await Post.count(query).limit(count);
//       } else {
//         query = {
//           createdAt: { $gte: today },
//           talentSubCategory: { $in: subCategoryIdArr[l] },
//         };
//         postsCount = await Post.count(query).count(count);
//       }

//       if ((pageNo && !limit) || (!pageNo && limit)) {
//         return res.status(INTERNALERROR).send(
//           sendError({
//             status: false,
//             message: 'invalid pagination parameters',
//             data: null,
//           })
//         );
//       }

//       if (views) {
//         if (pageNo && limit) {
//           posts = await Post.find(query)
//             .sort('-views')
//             .skip(skip)
//             .limit(limit)
//             .populate('talentCategory', { name: 1 })
//             .populate('talentSubCategory', { name: 1 })
//             .populate('userId', {
//               FirstName: 1,
//               LastName: 1,
//               'Config.ProfilePic': 1,
//             });
//         } else {
//           posts = await Post.find(query)
//             .sort('-views')
//             .limit(count)
//             .populate('talentCategory', { name: 1 })
//             .populate('talentSubCategory', { name: 1 })
//             .populate('userId', {
//               FirstName: 1,
//               LastName: 1,
//               'Config.ProfilePic': 1,
//             });
//         }
//       } else if (date) {
//         if (pageNo && limit) {
//           posts = await Post.find(query)
//             .sort('-createdAt')
//             .skip(skip)
//             .limit(limit)
//             .populate('talentCategory', { name: 1 })
//             .populate('talentSubCategory', { name: 1 })
//             .populate('userId', {
//               FirstName: 1,
//               LastName: 1,
//               'Config.ProfilePic': 1,
//             });
//         } else {
//           posts = await Post.find(query)
//             .sort('-createdAt')
//             .limit(count)
//             .populate('talentCategory', { name: 1 })
//             .populate('talentSubCategory', { name: 1 })
//             .populate('userId', {
//               FirstName: 1,
//               LastName: 1,
//               'Config.ProfilePic': 1,
//             });
//         }
//       } else {
//         if (pageNo && limit) {
//           posts = await Post.find(query)
//             .sort({ title: 1 })
//             .skip(skip)
//             .limit(limit)
//             .populate('talentCategory', { name: 1 })
//             .populate('talentSubCategory', { name: 1 })
//             .populate('userId', {
//               FirstName: 1,
//               LastName: 1,
//               'Config.ProfilePic': 1,
//             });
//         } else {
//           posts = await Post.find(query)
//             .sort({ title: 1 })
//             .limit(count)
//             .populate('talentCategory', { name: 1 })
//             .populate('talentSubCategory', { name: 1 })
//             .populate('userId', {
//               FirstName: 1,
//               LastName: 1,
//               'Config.ProfilePic': 1,
//             });
//         }
//       }

//       let result = posts.map(
//         ({
//           _id,
//           title,
//           desc,
//           userId,
//           type,
//           images,
//           videoImageUrl,
//           videoUrl,
//           videoType,
//           audioImageUrl,
//           audioUrl,
//           audioType,
//           views,
//           likes,
//           dislikes,
//           shares,
//           hashTags,
//           duration,
//           country,
//           isActive,
//           createdAt,
//           updatedAt,
//           talentCategory,
//           talentSubCategory,
//         }) => ({
//           _id,
//           title,
//           desc,
//           userId,
//           type,
//           images,
//           videoImageUrl,
//           videoUrl,
//           videoType,
//           audioImageUrl,
//           audioUrl,
//           audioType,
//           views,
//           likeCount: likes.length,
//           disLikeCount: dislikes.length,
//           shareCount: shares.length,
//           isLike:
//             likes.filter((id) => id === req?.user?._id).length > 0
//               ? true
//               : false,
//           isDislike:
//             dislikes.filter((id) => id === req?.user?._id).length > 0
//               ? true
//               : false,
//           isShare:
//             shares.filter((id) => id === req?.user?._id).length > 0
//               ? true
//               : false,
//           hashTags,
//           duration,
//           country,
//           isActive,
//           createdAt,
//           updatedAt,
//           talentCategory,
//           talentSubCategory,
//         })
//       );

//       if (likes) {
//         result.sort(function (a, b) {
//           return b.likeCount - a.likeCount;
//         });
//       }

//       // postCategories[param] = { posts : result, count: postsCount} ;
//       let obj = {};
//       obj[param] = { posts: result, count: postsCount };
//       postCategories.push(obj);
//     }

//     return res.status(OK).send(
//       sendSuccess({
//         status: true,
//         message: GET_SUCCESS_MESSAGES,
//         data: postCategories,
//       })
//     );
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

// @desc    Get Posts By Country
// @route   GET api/posts/country
//  @access  Public
// export const getPostsByCountry = async (req, res) => {
//   let {
//     country,
//     days,
//     count,
//     likes,
//     views,
//     date,
//     categoryId,
//     pageNo,
//     limit,
//     userId,
//   } = req.query;
//   var skip = limit * (pageNo - 1);
//   let postsCount = 0;

//   try {
//     let posts = [];
//     let query = '';

//     if ((pageNo && !limit) || (!pageNo && limit)) {
//       return res.status(INTERNALERROR).send(
//         sendError({
//           status: false,
//           message: 'invalid pagination parameters',
//           data: null,
//         })
//       );
//     }

//     if (userId) {
//       query = { country: { $regex: country, $options: 'i' }, userId: userId };
//       postsCount = await Post.count(query);
//     } else {
//       query = { country: { $regex: country, $options: 'i' } };
//       postsCount = await Post.count(query);
//     }

//     if (views) {
//       if (pageNo && limit) {
//         posts = await Post.find(query)
//           .sort('-views')
//           .skip(skip)
//           .limit(limit)
//           .populate('talentCategory', { name: 1 })
//           .populate('talentSubCategory', { name: 1 })
//           .populate('userId', {
//             FirstName: 1,
//             LastName: 1,
//             'Config.ProfilePic': 1,
//           });
//       } else {
//         posts = await Post.find(query)
//           .sort('-views')
//           .populate('talentCategory', { name: 1 })
//           .populate('talentSubCategory', { name: 1 })
//           .populate('userId', {
//             FirstName: 1,
//             LastName: 1,
//             'Config.ProfilePic': 1,
//           });
//       }
//     } else if (count) {
//       if (pageNo && limit) {
//         postsCount = await Post.count(query).limit(count);
//         posts = await Post.find(query)
//           .sort({ title: 1 })
//           .sort('-createdAt')
//           .skip(skip)
//           .limit(limit)
//           .populate('talentCategory', { name: 1 })
//           .populate('talentSubCategory', { name: 1 })
//           .populate('userId', {
//             FirstName: 1,
//             LastName: 1,
//             'Config.ProfilePic': 1,
//           });
//       } else {
//         postsCount = await Post.count(query).limit(count);
//         posts = await Post.find(query)
//           .sort({ title: 1 })
//           .sort('-createdAt')
//           .limit(count)
//           .populate('talentCategory', { name: 1 })
//           .populate('talentSubCategory', { name: 1 })
//           .populate('userId', {
//             FirstName: 1,
//             LastName: 1,
//             'Config.ProfilePic': 1,
//           });
//       }
//     } else if (categoryId) {
//       let categoryIdArr = categoryId.includes(',')
//         ? categoryId.split(',')
//         : [categoryId];
//       query = { ...query, talentCategory: { $in: categoryIdArr } };
//       postsCount = await Post.count(query);
//       if (pageNo && limit) {
//         posts = await Post.find(query)
//           .sort({ title: 1 })
//           .sort('-createdAt')
//           .skip(skip)
//           .limit(limit)
//           .populate('talentCategory', { name: 1 })
//           .populate('talentSubCategory', { name: 1 })
//           .populate('userId', {
//             FirstName: 1,
//             LastName: 1,
//             'Config.ProfilePic': 1,
//           });
//       } else {
//         posts = await Post.find(query)
//           .sort({ title: 1 })
//           .sort('-createdAt')
//           .populate('talentCategory', { name: 1 })
//           .populate('talentSubCategory', { name: 1 })
//           .populate('userId', {
//             FirstName: 1,
//             LastName: 1,
//             'Config.ProfilePic': 1,
//           });
//       }
//     } else {
//       if (pageNo && limit) {
//         posts = await Post.find(query)
//           .sort({ title: 1 })
//           .sort('-createdAt')
//           .skip(skip)
//           .limit(limit)
//           .populate('talentCategory', { name: 1 })
//           .populate('talentSubCategory', { name: 1 })
//           .populate('userId', {
//             FirstName: 1,
//             LastName: 1,
//             'Config.ProfilePic': 1,
//           });
//       } else {
//         posts = await Post.find(query)
//           .sort({ title: 1 })
//           .sort('-createdAt')
//           .populate('talentCategory', { name: 1 })
//           .populate('talentSubCategory', { name: 1 })
//           .populate('userId', {
//             FirstName: 1,
//             LastName: 1,
//             'Config.ProfilePic': 1,
//           });
//       }
//     }

//     let result = posts.map(
//       ({
//         _id,
//         title,
//         desc,
//         userId,
//         type,
//         images,
//         videoImageUrl,
//         videoUrl,
//         videoType,
//         audioImageUrl,
//         audioUrl,
//         audioType,
//         views,
//         likes,
//         dislikes,
//         shares,
//         hashTags,
//         duration,
//         country,
//         isActive,
//         createdAt,
//         updatedAt,
//         talentCategory,
//         talentSubCategory,
//       }) => ({
//         _id,
//         title,
//         desc,
//         userId,
//         type,
//         images,
//         videoImageUrl,
//         videoUrl,
//         videoType,
//         audioImageUrl,
//         audioUrl,
//         audioType,
//         views,
//         likeCount: likes.length,
//         disLikeCount: dislikes.length,
//         shareCount: shares.length,
//         isLike:
//           likes.filter((id) => id === req?.user?._id).length > 0 ? true : false,
//         isDislike:
//           dislikes.filter((id) => id === req?.user?._id).length > 0
//             ? true
//             : false,
//         isShare:
//           shares.filter((id) => id === req?.user?._id).length > 0
//             ? true
//             : false,
//         hashTags,
//         duration,
//         country,
//         isActive,
//         createdAt,
//         updatedAt,
//         talentCategory,
//         talentSubCategory,
//       })
//     );

//     if (likes) {
//       result.sort(function (a, b) {
//         return b.likeCount - a.likeCount;
//       });
//     }

//     return res.status(OK).send(
//       sendSuccess({
//         status: true,
//         message: GET_SUCCESS_MESSAGES,
//         data: result,
//         count: postsCount,
//       })
//     );
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

// @desc    Get Posts By Profile
// @route   GET api/posts/userProfile
//  @access  Public
export const getPostsByProfile = async (req, res) => {
  let { userId, pageNo, limit, likes, views, date } = req.query;
  var skip = limit * (pageNo - 1);

  try {
    if ((pageNo && !limit) || (!pageNo && limit)) {
      return res.status(INTERNALERROR).send(
        sendError({
          status: false,
          message: 'invalid pagination parameters',
          data: null,
        })
      );
    }

    let postsCount = await Post.count({ userId: userId });
    let posts = [];
    if (views) {
      if (pageNo && limit) {
        posts = await Post.find({ userId: userId })
          .sort('-views')
          .skip(skip)
          .limit(limit)
          .populate('talentCategory', { name: 1 })
          .populate('talentSubCategory', { name: 1 })
          .populate('userId', {
            FirstName: 1,
            LastName: 1,
            'Config.ProfilePic': 1,
          });
      } else {
        posts = await Post.find({ userId: userId })
          .sort('-views')
          .populate('talentCategory', { name: 1 })
          .populate('talentSubCategory', { name: 1 })
          .populate('userId', {
            FirstName: 1,
            LastName: 1,
            'Config.ProfilePic': 1,
          });
      }
    } else if (date) {
      if (pageNo && limit) {
        posts = await Post.find({ userId: userId })
          .sort('-createdAt')
          .skip(skip)
          .limit(limit)
          .populate('talentCategory', { name: 1 })
          .populate('talentSubCategory', { name: 1 })
          .populate('userId', {
            FirstName: 1,
            LastName: 1,
            'Config.ProfilePic': 1,
          });
      } else {
        posts = await Post.find({ userId: userId })
          .sort('-createdAt')
          .populate('talentCategory', { name: 1 })
          .populate('talentSubCategory', { name: 1 })
          .populate('userId', {
            FirstName: 1,
            LastName: 1,
            'Config.ProfilePic': 1,
          });
      }
    } else {
      if (pageNo && limit) {
        posts = await Post.find({ userId: userId })
          .sort({ title: 1 })
          .skip(skip)
          .limit(limit)
          .populate('talentCategory', { name: 1 })
          .populate('talentSubCategory', { name: 1 })
          .populate('userId', {
            FirstName: 1,
            LastName: 1,
            'Config.ProfilePic': 1,
          });
      } else {
        posts = await Post.find({ userId: userId })
          .sort({ title: 1 })
          .populate('talentCategory', { name: 1 })
          .populate('talentSubCategory', { name: 1 })
          .populate('userId', {
            FirstName: 1,
            LastName: 1,
            'Config.ProfilePic': 1,
          });
      }
    }

    let result = posts.map(
      ({
        _id,
        title,
        desc,
        userId,
        type,
        images,
        videoImageUrl,
        videoUrl,
        videoType,
        audioImageUrl,
        audioUrl,
        audioType,
        views,
        likes,
        dislikes,
        shares,
        hashTags,
        duration,
        country,
        isActive,
        createdAt,
        updatedAt,
        talentCategory,
        talentSubCategory,
      }) => ({
        _id,
        title,
        desc,
        userId,
        type,
        images,
        videoImageUrl,
        videoUrl,
        videoType,
        audioImageUrl,
        audioUrl,
        audioType,
        views,
        likeCount: likes.length,
        disLikeCount: dislikes.length,
        shareCount: shares.length,
        isLike:
          likes.filter((id) => id === req?.user?._id).length > 0 ? true : false,
        isDislike:
          dislikes.filter((id) => id === req?.user?._id).length > 0
            ? true
            : false,
        isShare:
          shares.filter((id) => id === req?.user?._id).length > 0
            ? true
            : false,
        hashTags,
        duration,
        country,
        isActive,
        createdAt,
        updatedAt,
        talentCategory,
        talentSubCategory,
      })
    );

    if (likes) {
      result.sort(function (a, b) {
        return b.likeCount - a.likeCount;
      });
    }

    return res.status(OK).send(
      sendSuccess({
        status: true,
        message: GET_SUCCESS_MESSAGES,
        data: result,
        count: postsCount,
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

// @desc    Get Posts By Profile
// @route   GET api/posts/userProfile
//  @access  Public
export const getUserFollowingPosts = async (req, res) => {
  let { pageNo, limit, likes, views, date } = req.query;
  let userId = req?.user?._id;
  var skip = limit * (pageNo - 1);

  try {
    if ((pageNo && !limit) || (!pageNo && limit)) {
      return res.status(INTERNALERROR).send(
        sendError({
          status: false,
          message: 'invalid pagination parameters',
          data: null,
        })
      );
    }

    let User = await Users.findOne(
      { _id: userId },
      { 'Config.637fd57b4ee18cb51682db2f': 1 }
    );

    let usersArr = [];
    if (User.Config.followings.length) {
      for (let i = 0; i < User.Config.followings.length; i++) {
        let id = User.Config.followings[i];
        usersArr.push(id);
      }
    } else {
      return res.status(OK).send(
        sendSuccess({
          status: false,
          message: GET_UNSUCCESS_MESSAGES,
          data: null,
        })
      );
    }
    let postsCount = await Post.count({ userId: { $in: usersArr } });
    let posts = [];

    if (views) {
      if (pageNo && limit) {
        posts = await Post.find({ userId: { $in: usersArr } })
          .sort('-views')
          .skip(skip)
          .limit(limit)
          .populate('talentCategory', { name: 1 })
          .populate('talentSubCategory', { name: 1 })
          .populate('userId', {
            FirstName: 1,
            LastName: 1,
            'Config.ProfilePic': 1,
          });
      } else {
        posts = await Post.find({ userId: { $in: usersArr } })
          .sort('-views')
          .populate('talentCategory', { name: 1 })
          .populate('talentSubCategory', { name: 1 })
          .populate('userId', {
            FirstName: 1,
            LastName: 1,
            'Config.ProfilePic': 1,
          });
      }
    } else if (date) {
      if (pageNo && limit) {
        posts = await Post.find({ userId: { $in: usersArr } })
          .sort('-createdAt')
          .skip(skip)
          .limit(limit)
          .populate('talentCategory', { name: 1 })
          .populate('talentSubCategory', { name: 1 })
          .populate('userId', {
            FirstName: 1,
            LastName: 1,
            'Config.ProfilePic': 1,
          });
      } else {
        posts = await Post.find({ userId: { $in: usersArr } })
          .sort('-createdAt')
          .populate('talentCategory', { name: 1 })
          .populate('talentSubCategory', { name: 1 })
          .populate('userId', {
            FirstName: 1,
            LastName: 1,
            'Config.ProfilePic': 1,
          });
      }
    } else {
      if (pageNo && limit) {
        posts = await Post.find({ userId: { $in: usersArr } })
          .sort({ title: 1 })
          .skip(skip)
          .limit(limit)
          .populate('talentCategory', { name: 1 })
          .populate('talentSubCategory', { name: 1 })
          .populate('userId', {
            FirstName: 1,
            LastName: 1,
            'Config.ProfilePic': 1,
          });
      } else {
        posts = await Post.find({ userId: { $in: usersArr } })
          .sort({ title: 1 })
          .populate('talentCategory', { name: 1 })
          .populate('talentSubCategory', { name: 1 })
          .populate('userId', {
            FirstName: 1,
            LastName: 1,
            'Config.ProfilePic': 1,
          });
      }
    }

    let result = posts.map(
      ({
        _id,
        title,
        desc,
        userId,
        type,
        images,
        videoImageUrl,
        videoUrl,
        videoType,
        audioImageUrl,
        audioUrl,
        audioType,
        views,
        likes,
        dislikes,
        shares,
        hashTags,
        duration,
        country,
        isActive,
        createdAt,
        updatedAt,
        talentCategory,
        talentSubCategory,
      }) => ({
        _id,
        title,
        desc,
        userId,
        type,
        images,
        videoImageUrl,
        videoUrl,
        videoType,
        audioImageUrl,
        audioUrl,
        audioType,
        views,
        likeCount: likes.length,
        disLikeCount: dislikes.length,
        shareCount: shares.length,
        isLike:
          likes.filter((id) => id === req?.user?._id).length > 0 ? true : false,
        isDislike:
          dislikes.filter((id) => id === req?.user?._id).length > 0
            ? true
            : false,
        isShare:
          shares.filter((id) => id === req?.user?._id).length > 0
            ? true
            : false,
        hashTags,
        duration,
        country,
        isActive,
        createdAt,
        updatedAt,
        talentCategory,
        talentSubCategory,
      })
    );

    if (likes) {
      result.sort(function (a, b) {
        return b.likeCount - a.likeCount;
      });
    }

    return res.status(OK).send(
      sendSuccess({
        status: true,
        message: GET_SUCCESS_MESSAGES,
        data: result,
        count: postsCount,
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

// @desc    Get Posts By Profile
// @route   GET api/posts/hashTags
//  @access  Public
export const getPostsByHashTags = async (req, res) => {
  const { days, count, hashTags, likes, views, date, pageNo, limit, userId } =
    req.query;

  try {
    let posts = [];
    let postsCount = 0;
    let query = '';
    var skip = limit * (pageNo - 1);
    let hashTagsArr = hashTags.includes(',') ? hashTags.split(',') : [hashTags];
    hashTagsArr = hashTagsArr.map(function (val) {
      return new RegExp(val, 'i');
    });

    if ((pageNo && !limit) || (!pageNo && limit)) {
      return res.status(INTERNALERROR).send(
        sendError({
          status: false,
          message: 'invalid pagination parameters',
          data: null,
        })
      );
    }

    if (userId) {
      query = { hashTags: { $in: hashTagsArr }, userId: userId };
      postsCount = await Post.count(query);
    } else {
      query = { hashTags: { $in: hashTagsArr } };
      postsCount = await Post.count(query);
    }

    if (views) {
      if (pageNo && limit) {
        posts = await Post.find(query)
          .sort('-views')
          .skip(skip)
          .limit(limit)
          .populate('talentCategory', { name: 1 })
          .populate('talentSubCategory', { name: 1 })
          .populate('userId', {
            FirstName: 1,
            LastName: 1,
            'Config.ProfilePic': 1,
          });
      } else {
        posts = await Post.find(query)
          .sort('-views')
          .populate('talentCategory', { name: 1 })
          .populate('talentSubCategory', { name: 1 })
          .populate('userId', {
            FirstName: 1,
            LastName: 1,
            'Config.ProfilePic': 1,
          });
      }
    } else if (count) {
      postsCount = await Post.count(query).count();

      if (pageNo && limit) {
        posts = await Post.find(query)
          .sort('-createdAt')
          .skip(skip)
          .limit(limit)
          .populate('talentCategory', { name: 1 })
          .populate('talentSubCategory', { name: 1 })
          .populate('userId', {
            FirstName: 1,
            LastName: 1,
            'Config.ProfilePic': 1,
          });
      } else {
        posts = await Post.find(query)
          .sort('-createdAt')
          .limit(count)
          .populate('talentCategory', { name: 1 })
          .populate('talentSubCategory', { name: 1 })
          .populate('userId', {
            FirstName: 1,
            LastName: 1,
            'Config.ProfilePic': 1,
          });
      }
    } else if (days) {
      var today = new Date();
      today.setDate(today.getDate() - days);
      query = { ...query, createdAt: { $gte: today } };
      postsCount = await Post.count(query);
      postsCount = await Post.count(query);
      if (pageNo && limit) {
        posts = await Post.find(query)
          .sort({ title: 1 })
          .skip(skip)
          .limit(limit)
          .populate('talentCategory', { name: 1 })
          .populate('talentSubCategory', { name: 1 })
          .populate('userId', {
            FirstName: 1,
            LastName: 1,
            'Config.ProfilePic': 1,
          });
      } else {
        posts = await Post.find(query)
          .sort({ title: 1 })
          .populate('talentCategory', { name: 1 })
          .populate('talentSubCategory', { name: 1 })
          .populate('userId', {
            FirstName: 1,
            LastName: 1,
            'Config.ProfilePic': 1,
          });
      }
    } else if (date) {
      if (pageNo && limit) {
        posts = await Post.find(query)
          .sort('-createdAt')
          .skip(skip)
          .limit(limit)
          .populate('talentCategory', { name: 1 })
          .populate('talentSubCategory', { name: 1 })
          .populate('userId', {
            FirstName: 1,
            LastName: 1,
            'Config.ProfilePic': 1,
          });
      } else {
        posts = await Post.find(query)
          .sort('-createdAt')
          .populate('talentCategory', { name: 1 })
          .populate('talentSubCategory', { name: 1 })
          .populate('userId', {
            FirstName: 1,
            LastName: 1,
            'Config.ProfilePic': 1,
          });
      }
    } else {
      if (pageNo && limit) {
        posts = await Post.find(query)
          .sort('-createdAt')
          .sort({ title: 1 })
          .skip(skip)
          .limit(limit)
          .populate('talentCategory', { name: 1 })
          .populate('talentSubCategory', { name: 1 })
          .populate('userId', {
            FirstName: 1,
            LastName: 1,
            'Config.ProfilePic': 1,
          });
      } else {
        posts = await Post.find(query)
          .sort('-createdAt')
          .sort({ title: 1 })
          .populate('talentCategory', { name: 1 })
          .populate('talentSubCategory', { name: 1 })
          .populate('userId', {
            FirstName: 1,
            LastName: 1,
            'Config.ProfilePic': 1,
          });
      }
    }

    let result = posts.map(
      ({
        _id,
        title,
        desc,
        userId,
        type,
        images,
        videoImageUrl,
        videoUrl,
        videoType,
        audioImageUrl,
        audioUrl,
        audioType,
        views,
        likes,
        dislikes,
        shares,
        hashTags,
        duration,
        country,
        isActive,
        createdAt,
        updatedAt,
        talentCategory,
        talentSubCategory,
      }) => ({
        _id,
        title,
        desc,
        userId,
        type,
        images,
        videoImageUrl,
        videoUrl,
        videoType,
        audioImageUrl,
        audioUrl,
        audioType,
        views,
        likeCount: likes.length,
        disLikeCount: dislikes.length,
        shareCount: shares.length,
        isLike:
          likes.filter((id) => id === req?.user?._id).length > 0 ? true : false,
        isDislike:
          dislikes.filter((id) => id === req?.user?._id).length > 0
            ? true
            : false,
        isShare:
          shares.filter((id) => id === req?.user?._id).length > 0
            ? true
            : false,
        hashTags,
        duration,
        country,
        isActive,
        createdAt,
        updatedAt,
        talentCategory,
        talentSubCategory,
      })
    );

    if (likes) {
      result.sort(function (a, b) {
        return b.likeCount - a.likeCount;
      });
    }

    return res.status(OK).send(
      sendSuccess({
        status: true,
        message: GET_SUCCESS_MESSAGES,
        data: result,
        count: postsCount,
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

// @desc    Get Posts By Search keyword
// @route   GET api/posts/searchAll
//  @access  Public
export const searchAll = async (req, res) => {
  try {
    let { keyWord, limit } = req.query;
    const id = req?.user?._id;
    // search in posts
    let posts = await Post.find({
      $or: [
        { title: { $regex: `${keyWord}`, $options: 'i' } },
        { desc: { $regex: `${keyWord}`, $options: 'i' } },
      ],
    })
      .limit(limit)
      .populate('talentCategory', { name: 1 })
      .populate('talentSubCategory', { name: 1 })
      .populate('userId', {
        FirstName: 1,
        LastName: 1,
        'Config.ProfilePic': 1,
      });

    // search in Posts with HashTags
    const hashTagspPosts = await Post.find({
      hashTags: { $regex: `${keyWord}`, $options: 'i' },
    })
      .limit(limit)
      .populate('talentCategory', { name: 1 })
      .populate('talentSubCategory', { name: 1 })
      .populate('userId', {
        FirstName: 1,
        LastName: 1,
        'Config.ProfilePic': 1,
      });

    // search in users
    const users = await Users.find(
      { FirstName: { $regex: `${keyWord}`, $options: 'i' } },
      {
        FirstName: 1,
        LastName: 1,
        'Authentication.Email': 1,
        'Config.followings': 1,
        'Config.followers': 1,
        'Config.ProfilePic': 1,
        'Config.CoverPhoto': 1,
      }
    )
      .limit(limit)
      .lean();

    if (users) {
      for (let i = 0; i < users.length; i++) {
        users[i].followers = 0;
        users[i].followings = 0;
        users[i].isFollow = false;
        if (users[i].Config.followers) {
          let followersUsers = users[i].Config.followers;
          for (let l = 0; l < followersUsers.length; l++) {
            if (followersUsers[l] == id) {
              users[i].isFollow = true;
            }
          }
          users[i].followers = users[i].Config.followers.length;
        }
        if (users[i].Config.followings) {
          users[i].followings = users[i].Config.followings.length;
        }
      }
    }
    // search in hashtags
    const hashtags = await HashTags.find({
      name: { $regex: `${keyWord}`, $options: 'i' },
    }).limit(limit);

    return res.status(OK).send(
      sendSuccess({
        status: true,
        message: GET_SUCCESS_MESSAGES,
        data: { posts, hashTagspPosts, users, hashtags },
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

// @desc    Get Users By Search keyword
// @route   GET api/posts/searchUsers
//  @access  Public
export const searchUsers = async (req, res) => {
  try {
    let { keyWord, limit, pageNo } = req.query;
    let skip = limit * (pageNo - 1);
    const id = req?.user?._id;

    if ((pageNo && !limit) || (!pageNo && limit)) {
      return res.status(INTERNALERROR).send(
        sendError({
          status: false,
          message: 'invalid pagination parameters',
          data: null,
        })
      );
    }

    // search in users
    const count = await Users.count({
      FirstName: { $regex: `${keyWord}`, $options: 'i' },
    });
    const users = await Users.find(
      { FirstName: { $regex: `${keyWord}`, $options: 'i' } },
      {
        FirstName: 1,
        LastName: 1,
        'Authentication.Email': 1,
        'Config.followings': 1,
        'Config.followers': 1,
        'Config.ProfilePic': 1,
        'Config.CoverPhoto': 1,
      }
    )
      .skip(skip)
      .limit(limit)
      .lean();

    if (users) {
      for (let i = 0; i < users.length; i++) {
        users[i].followers = 0;
        users[i].followings = 0;
        users[i].isFollow = false;
        if (users[i].Config.followers) {
          let followersUsers = users[i].Config.followers;
          for (let l = 0; l < followersUsers.length; l++) {
            if (followersUsers[l] == id) {
              users[i].isFollow = true;
            }
          }
          users[i].followers = users[i].Config.followers.length;
        }
        if (users[i].Config.followings) {
          users[i].followings = users[i].Config.followings.length;
        }
      }
    }

    return res.status(OK).send(
      sendSuccess({
        status: true,
        message: GET_SUCCESS_MESSAGES,
        data: users,
        count: count,
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

// @desc    Get Posts By Search keyword
// @route   GET api/posts/searchPosts
//  @access  Public
export const searchPosts = async (req, res) => {
  try {
    let { keyWord, limit, pageNo } = req.query;
    let skip = limit * (pageNo - 1);

    if ((pageNo && !limit) || (!pageNo && limit)) {
      return res.status(INTERNALERROR).send(
        sendError({
          status: false,
          message: 'invalid pagination parameters',
          data: null,
        })
      );
    }

    // search in posts
    let count = await Post.count({
      $or: [
        { title: { $regex: `${keyWord}`, $options: 'i' } },
        { desc: { $regex: `${keyWord}`, $options: 'i' } },
      ],
    });
    let posts = await Post.find({
      $or: [
        { title: { $regex: `${keyWord}`, $options: 'i' } },
        { desc: { $regex: `${keyWord}`, $options: 'i' } },
      ],
    })
      .sort('-createdAt')
      .skip(skip)
      .limit(limit)
      .populate('talentCategory', { name: 1 })
      .populate('talentSubCategory', { name: 1 })
      .populate('userId', {
        FirstName: 1,
        LastName: 1,
        'Config.ProfilePic': 1,
      });

    return res.status(OK).send(
      sendSuccess({
        status: true,
        message: GET_SUCCESS_MESSAGES,
        data: posts,
        count: count,
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

// @desc    Get HashTag Posts By Search keyword
// @route   GET api/posts/searchHashTagsPosts
//  @access  Public
export const searchHashTagsPosts = async (req, res) => {
  try {
    let { keyWord, limit, pageNo } = req.query;
    let skip = limit * (pageNo - 1);

    if ((pageNo && !limit) || (!pageNo && limit)) {
      return res.status(INTERNALERROR).send(
        sendError({
          status: false,
          message: 'invalid pagination parameters',
          data: null,
        })
      );
    }
    // get count
    const count = await Post.count({
      hashTags: { $regex: `${keyWord}`, $options: 'i' },
    });
    // search in hashTagsPosts
    const hashTagspPosts = await Post.find({
      hashTags: { $regex: `${keyWord}`, $options: 'i' },
    })
      .sort('-createdAt')
      .skip(skip)
      .limit(limit)
      .populate('talentCategory', { name: 1 })
      .populate('talentSubCategory', { name: 1 })
      .populate('userId', {
        FirstName: 1,
        LastName: 1,
        'Config.ProfilePic': 1,
      });

    return res.status(OK).send(
      sendSuccess({
        status: true,
        message: GET_SUCCESS_MESSAGES,
        data: hashTagspPosts,
        count: count,
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

// @desc    Get HashTags By Search keyword
// @route   GET api/posts/searchHashTags
//  @access  Public
export const searchHashTags = async (req, res) => {
  try {
    let { keyWord, limit, pageNo } = req.query;
    let skip = limit * (pageNo - 1);

    if ((pageNo && !limit) || (!pageNo && limit)) {
      return res.status(INTERNALERROR).send(
        sendError({
          status: false,
          message: 'invalid pagination parameters',
          data: null,
        })
      );
    }

    // search in hashTags
    const count = await HashTags.count({
      name: { $regex: `${keyWord}`, $options: 'i' },
    });
    const hashTags = await HashTags.find({
      name: { $regex: `${keyWord}`, $options: 'i' },
    })
      .sort('-createdAt')
      .skip(skip)
      .limit(limit);

    return res.status(OK).send(
      sendSuccess({
        status: true,
        message: GET_SUCCESS_MESSAGES,
        data: hashTags,
        count: count,
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

// @desc    update JobAd View By Id
// @route   PUT api/jobAd/view/:id
// @access  Public
export const addView = async (req, res, next) => {
  try {
    await JobAd.findByIdAndUpdate(req.params.id, {
      $inc: { views: 1 },
    });
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

// @desc    update Post  By Id
// @route   PUT api/jobAds/like/:jobAdId
// @access  Public
export const like = async (req, res, next) => {
  const id = req.user._id;
  const jobAdId = req.params.jobAdId;
  try {
    await JobAd.findByIdAndUpdate(jobAdId, {
      $addToSet: { likes: id },
      $pull: { dislikes: id },
    });
    return res.status(OK).send(
      sendSuccess({
        status: true,
        message: 'The post has been liked.',
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

// @desc    update Post View By Id
// @route   PUT api/posts/dislike/:postId
// @access  Public
export const dislike = async (req, res, next) => {
  const id = req.user._id;
  const jobAdId = req.params.jobAdId;
  try {
    await JobAd.findByIdAndUpdate(jobAdId, {
      $addToSet: { dislikes: id },
      $pull: { likes: id },
    });
    return res.status(OK).send(
      sendSuccess({
        status: true,
        message: 'The post has been disliked.',
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

// @desc    update Post View By Id
// @route   PUT api/posts/share/:postId
// @access  Public
export const share = async (req, res, next) => {
  const id = req.user._id;
  const postId = req.params.postId;
  try {
    await Post.findByIdAndUpdate(postId, {
      $addToSet: { shares: id },
      $pull: { likes: id },
    });
    return res.status(OK).send(
      sendSuccess({
        status: true,
        message: 'The post has been shared.',
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


export const ReportJobController = async (req, res) => {
  const { jobId } = req.params;
  const { userId, reason, details } = req.body;

  try {
    // Check if the user has already reported this job
    const existingReport = await ReportSchema.findOne({ job: jobId, reporter: userId });
    if (existingReport) {
      return res.status(BADREQUEST).send(
        sendError({
          status: false,
          message: "You have already reported this job",
          data: null
        })
      )
    }

    // Create a new report
    const newReport = new ReportSchema({
      job: jobId,
      reporter: userId,
      reason,
      details
    });
    await newReport.save();

    // Increment the report count on the job
    await JobAd.findByIdAndUpdate(jobId, { $inc: { reportCount: 1 } });

    res.status(CREATED).send(
      sendSuccess({
        status: true,
        message: "Job reported successfully",
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
export const approveJob = async (req, res) => {
  const { jobId } = req.params;

  try {
    // Assume req.user contains user info and we check if they're an admin
    if (!req.user || !req.user.isAdmin) {
      return res.status(UNAUTHORIZED).send(
        sendError({
          status: false,
          message: "Access denied. Admins only.",
        })
      );
    }

    // Check if jobId exists
    if (!jobId) {
      return res.status(NOTFOUND).send(
        sendError({
          status: false,
          message: "Job ID is required.",
        })
      );
    }

    // Find the job by ID
    const job = await JobAd.findById(jobId);
    if (!job) {
      return res.status(NOTFOUND).send(
        sendError({
          status: false,
          message: "Job not found.",
        })
      );
    }

    // Update the job's isVerified status to true
    job.isVerified = true;

    await redis.del(`/api/jobAds/${req.params.jobId}${process.env.CACHE_KEY}`);
    const pattern = `/api/jobAds/all?limit=*&pageNo=*&keyWord=*&category=*${process.env.CACHE_KEY}`
    await scanAndDelete(pattern);

    // Save the job
    await job.save();

    res.status(OK).send(
      sendSuccess({
        status: true,
        message: "Job approved successfully.",
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

export const EasyApplyController = async (req, res) => {
  try {

    const { jobTitle, jobCompany, userName, resumeUrl, applyEmail, firstName
      , lastName, email } = req.body;

    if (!jobTitle, !jobCompany, !userName, !resumeUrl, !applyEmail, !firstName, !lastName, !email) {
      return res.status(BADREQUEST).send(
        sendError({
          status: false,
          message: MISSING_FIELDS,
        })
      );
    }

    const profileUrl = `${process.env.FRONTEND_BASE_URL}/peopleprofile/${userName}`
    const emailData = {
      to: applyEmail, //applyEmail, // HR's email from job posting
      subject: `New Job Application: ${jobTitle}`,
      html: JobApplicationTemplate(jobTitle, jobCompany, (firstName + lastName), email, profileUrl, resumeUrl, new Date().toLocaleDateString()),
    };

    const response = await sendEmail(emailData);
    res.status(200).send(
      sendSuccess({
        status: true,
        message: "Application submitted successfully",
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


export const generateJobPosting = async (req, res) => {
  try {

    const { jobDescription } = req.body

    const chatSession = jobPostingModel.startChat({
      generationConfig,
    });

    if (!jobDescription) return res.status(BADREQUEST).send(
      sendError({
        status: false,
        message: "Job Description is required",
        data: null
      })
    )


    const instr = `Job Description to analyze:
                ${jobDescription}
                    Generate the job posting data structure.`
    const result = await chatSession.sendMessage(instr);
    //  Access the 'text' property
    let jsonString = result.response.text();
    // console.log("jsonString ", jsonString)
    //  Remove the markdown code block and trim whitespace
    jsonString = jsonString.replace("```json", "").replace("```", "").trim();


    res.status(200).send(
      sendSuccess({
        status: true,
        message: "Pre-fill Job form data",
        data: JSON.parse(jsonString)
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


export const generateJobPostByImage = async (request, response) => {
  try {

    if (!request.file) return response.status(BADREQUEST).send(
      sendError({
        status: false,
        message: "Job Description is required",
        data: null
      })
    )

    // Using promises
    const buffer = await fs.promises.readFile(request.file.path);

    // Helper function to convert image to base64
    function fileToGenerativePart(buffer, mimeType) {
      return {
        inlineData: {
          data: buffer.toString('base64'),
          mimeType
        }
      };
    }

    // Prepare the image for the API
    const imagePart = fileToGenerativePart(buffer, request.file.mimetype);

    const prompt = `Analyze this job posting image and extract all relevant information. Pay special attention to:
- Company branding and logos
- Job title and position level
- Required qualifications and experience
- Salary and benefits information
- Contact details and application method
- Location and work arrangement details
Generate a complete job posting data structure based on the visible information.`;

    // Generate content
    const result = await jobImageModel.generateContent([prompt, imagePart]);
    let jsonString = result.response.text();

    //  Remove the markdown code block and trim whitespace
    jsonString = jsonString.replace("```json", "").replace("```", "").trim();

    response.status(200).send(
      sendSuccess({
        status: true,
        message: "Pre-fill Job form data",
        data: JSON.parse(jsonString)
      })
    );
    try {
      await fs.promises.unlink(request.file.path);
      console.log("Successfully removed image");
    } catch (err) {
      console.error("Error removing image:", err.message);
    }

  } catch (error) {
    console.log("error", error)
    response.status(INTERNALERROR).send(
      sendError({
        status: false,
        message: error.message,
        data: null
      })
    );
  }
}