import { redis } from "../app.js";
import { BADREQUEST, CREATED, INTERNALERROR, OK } from "../constants/httpStatus.js";
import { responseMessages } from "../constants/responseMessages.js";
import Filteration from "../models/Filteration.js";
import { sendError, sendSuccess } from "../utils/responses.js";

const { ADD_SUCCESS_MESSAGES, GET_SUCCESS_MESSAGES, MISSING_FIELDS } = responseMessages

export const addFilteration = async (req, res) => {
    const { type } = req.query;
    const userId = req.user._id;
    await redis.del(`/api/filterations/all${process.env.CACHE_KEY}`);
    await redis.del(`/api/filterations/all?type=users${process.env.CACHE_KEY}`);
    try {
        const {
            filterationName,
            filterationOptions,
            propertyName,
            fieldName,
            isActive = true,
        } = req.body;
        let filterationDetails = {};
        if (filterationName && filterationOptions && propertyName && fieldName) {
            if (type === 'jobs') {
                filterationDetails = {
                    filterationName,
                    filterationOptions,
                    createdBy: userId,
                    propertyName,
                    fieldName,
                    isActive,
                };
            } else {
                filterationDetails = {
                    filterationName,
                    filterationOptions,
                    createdBy: userId,
                    propertyName,
                    fieldName,
                    isActive,
                    type,
                };
            }
        } else {
            return res.status(BADREQUEST).send(
                sendError({
                    status: false,
                    message: MISSING_FIELDS,
                })
            );
        }
        // return res.status(OK).send(
        //     sendSuccess({
        //         status: true,
        //         message: GET_SUCCESS_MESSAGES,
        //         data: filterationDetails,
        //     })
        // );
        const filteration = new Filteration(filterationDetails);
        const result = await filteration.save();

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

export const getFilteration = async (req, res) => {
    const { type } = req.query;
    const cacheKey = req.originalUrl + process.env.CACHE_KEY;
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
        res.status(OK).send(
            sendSuccess({
                status: true,
                message: GET_SUCCESS_MESSAGES,
                ...JSON.parse(cachedData)
            })
        );
    } else {

        try {
            if (!type) {
                const filterationCount = await Filteration.count({ type: { $ne: 'users' } });
                const filteration = await Filteration.find({ type: { $ne: 'users' } })
                    .sort('createdAt')
                // .populate('createdBy', {
                //     FirstName: 1,
                //     LastName: 1,
                //     'Config.ProfilePic': 1,
                // })
                // .populate('updatedBy', {
                //     FirstName: 1,
                //     LastName: 1,
                //     'Config.ProfilePic': 1,
                // });

                const filterationData = {
                    filterationValues: filteration.map(({ fieldName }) => ({ [fieldName]: [] })),
                    filteration
                }

                redis.setex(cacheKey, process.env.REDIS_SECONDS, JSON.stringify({
                    data: filterationData,
                    count: filterationCount
                }));

                return res.status(OK).send(
                    sendSuccess({
                        status: true,
                        message: GET_SUCCESS_MESSAGES,
                        data: filterationData,
                        count: filterationCount,
                    })
                );
            } else {
                const filterationCount = await Filteration.count({
                    type,
                });
                const filteration = await Filteration.find({ type })
                    .sort('-postCounts')
                // .populate('createdBy', {
                //     FirstName: 1,
                //     LastName: 1,
                //     'Config.ProfilePic': 1,
                // })
                // .populate('updatedBy', {
                //     FirstName: 1,
                //     LastName: 1,
                //     'Config.ProfilePic': 1,
                // });

                const filterationData = {
                    filterationValues: filteration.map(({ fieldName }) => ({ [fieldName]: [] })),
                    filteration
                }

                redis.setex(cacheKey, process.env.REDIS_SECONDS, JSON.stringify({
                    data: filterationData,
                    count: filterationCount
                }));

                return res.status(OK).send(
                    sendSuccess({
                        status: true,
                        message: GET_SUCCESS_MESSAGES,
                        data: filterationData,
                        count: filterationCount,
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
}