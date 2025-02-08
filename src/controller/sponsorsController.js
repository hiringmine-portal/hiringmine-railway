// @desc    update Sponsor View
// @route   PUT api/sponsors

import { INTERNALERROR, OK } from "../constants/httpStatus.js";
import Sponsors from "../models/Sponsors.js";
import { sendError, sendSuccess } from "../utils/responses.js";

// @access  Public
export const addSponsorViews = async (req, res, next) => {
    try {
        const sponsors = await Sponsors.find();
        await Sponsors.findOneAndUpdate({ id: '662cda12c00aecbcd07e9f9c' }, {
            $inc: {
                views: 1,
            },
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