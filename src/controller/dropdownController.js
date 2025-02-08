import { INTERNALERROR, OK } from "../constants/httpStatus.js";
import Dropdown from "../models/DropdownSchema.js";
import { responseMessages } from "../constants/responseMessages.js";
import { sendError, sendSuccess } from "../utils/responses.js";
import Register from "../models/Register.js";
import ExperienceSchema from "../models/ExperienceSchema.js";
import Country from "../models/Countries.js";
import City from "../models/Cities.js";
import { redis } from "../app.js";
import mongoose from "mongoose";

//@desc     DROPDOWN RECOMMENDATION DROPDOWN
//@route    POST api/dropdown/recommendation
//@access   Private


export const addDropdown = async (req, res) => {
    try {
        const { type, options } = req.body;
        const dropdown = new Dropdown({
            type, options
        });
        const newDropdown = await dropdown.save();
        return res.status(OK).send(
            sendSuccess({
                status: true,
                message: responseMessages.ADD_SUCCESS_MESSAGES,
                data: newDropdown,
            })
        );
    }
    catch (error) {
        return res.status(INTERNALERROR).send(
            sendError({
                status: false,
                message: error.message,
                data: null,
            })
        );
    }
}

//@desc     USERS GET RECOMMENDATION DROPDOWN
//@route    GET api/users/dropdown/recommendation
//@access   Private

export const getRecommendationDropdown = async (req, res) => {
    const { id } = req.params;
    const { type } = req.query;
    try {

        const cacheKey = req.originalUrl + process.env.CACHE_KEY;
        const cachedData = await redis.get(cacheKey);
        if (cachedData) {
            return res.status(OK).send(
                sendSuccess({
                    status: true,
                    message: responseMessages.GET_SUCCESS_MESSAGES,
                    data: JSON.parse(cachedData),
                })
            );
        }

        let finalDropDown;
        let userIdToUse = id;

        const user = await Register.findOne({ userName: id });
        userIdToUse = user._id;

        if (type === 'recommendationRelationship') {
            const user = await Register.findById({ _id: userIdToUse });

            const dropdowns = await Dropdown.findOne({
                type
            });


            if (!dropdowns) {
                return res.status(404).json(sendError({ message: 'Dropdown not found' }));
            }

            finalDropDown = dropdowns.options.map(obj => {
                return { value: obj.value.replace(/name/g, user.userName) };
            });
        }
        if (type === 'recommendationPosition') {
            const experiences = await ExperienceSchema.find({ user: userIdToUse });
            console.log(experiences, "==>> experiences")

            finalDropDown = experiences.map(obj => {
                return { value: `${obj.position} at ${obj.companyName}` };
            });
        }

        // Cache the data for 1 hour
        redis.setex(cacheKey, process.env.REDIS_SECONDS, JSON.stringify(finalDropDown));
        return res.status(OK).send(
            sendSuccess({
                status: true,
                message: responseMessages.GET_SUCCESS_MESSAGES,
                data: finalDropDown,
            })
        );
    }
    catch (error) {
        return res.status(INTERNALERROR).send(
            sendError({
                status: false,
                message: error.message,
                data: null,
            })
        );
    }
}

//@desc     GET ALL COUNTRIES
//@route    GET api/countries
//@access   Public

export const getAllCountriesDropdown = async (req, res) => {
    try {
        const cacheKey = req.originalUrl + process.env.CACHE_KEY;
        const cachedData = await redis.get(cacheKey);
        if (cachedData) {
            return res.status(OK).send(
                sendSuccess({
                    status: true,
                    message: 'Countries fetched successfully',
                    data: JSON.parse(cachedData)
                })
            );
        }
        const countries = await Country.find({}, 'id name iso2');

        if (!countries || countries.length === 0) {
            return res.status(404).json(sendError({
                status: false,
                message: 'Countries not found',
                data: null,
            }));
        }
        redis.setex(cacheKey, process.env.REDIS_SECONDS, JSON.stringify(countries));
        return res.status(200).send({
            status: true,
            message: 'Countries fetched successfully',
            data: countries,
        });
    } catch (error) {
        return res.status(500).send({
            status: false,
            message: error.message,
            data: null,
        });
    }
};


//@desc     GET ALL CITIES BY COUNTRY
//@route    GET api/cities
//@access   Public

export const getAllCitiesDropdown = async (req, res) => {
    const { id } = req.params;

    const cacheKey = req.originalUrl + process.env.CACHE_KEY;
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
        return res.status(OK).send(
            sendSuccess({
                status: true,
                message: 'Cities fetched successfully',
                data: JSON.parse(cachedData)
            })
        );
    }

    try {
        const cities = await City.find({ country_code: id }, 'id name country_code');

        if (!cities || cities.length === 0) {
            return res.status(404).json(
                sendError(
                    {
                        status: false,
                        message: 'Cities not found',
                        data: null,
                    }
                )

            );
        }

        redis.setex(cacheKey, process.env.REDIS_SECONDS, JSON.stringify(cities));

        return res.status(200).send(
            sendSuccess(
                {
                    status: true,
                    message: 'Cities fetched successfully',
                    data: cities,
                }
            )
        );
    } catch (error) {
        return res.status(500).send(sendError({
            status: false,
            message: error.message,
            data: null,
        }));
    }
};