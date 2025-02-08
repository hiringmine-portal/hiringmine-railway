import { redis } from "../app.js";
import { BADREQUEST, CREATED, INTERNALERROR, OK } from "../constants/httpStatus.js";
import { responseMessages } from "../constants/responseMessages.js";
import Categories from "../models/Categories.js";
import { sendError, sendSuccess } from "../utils/responses.js";

const { ADD_SUCCESS_MESSAGES, GET_SUCCESS_MESSAGES, MISSING_FIELDS } = responseMessages

export const addCategory = async (req, res) => {
    const userId = req.user._id;
    await redis.del(`/api/categories/all${process.env.CACHE_KEY}`);
    try {
        const {
            name,
            description,
        } = req.body;
        let categoryDetails = {};
        if (name && description) {
            categoryDetails = {
                name,
                description,
                createdBy: userId,
            };
        } else {
            return res.status(BADREQUEST).send(
                sendError({
                    status: false,
                    message: MISSING_FIELDS,
                })
            );
        }

        const category = new Categories(categoryDetails);
        const result = await category.save();

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

export const getCategories = async (req, res) => {
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
            const categoriesCount = await Categories.count();
            const categories = await Categories.find({})
                .sort('-postCounts')
            // .populate('createdBy', {
            //     firstName: 1,
            //     lastName: 1,
            //     profilePic: 1,
            // })
            // .populate('updatedBy', {
            //     firstName: 1,
            //     lastName: 1,
            //     profilePic: 1,
            // });
            redis.setex(cacheKey, process.env.REDIS_SECONDS, JSON.stringify({
                data: categories,
                count: categoriesCount,
            }));
            return res.status(OK).send(
                sendSuccess({
                    status: true,
                    message: GET_SUCCESS_MESSAGES,
                    data: categories,
                    count: categoriesCount,
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
}