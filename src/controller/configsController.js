import { OK } from "../constants/httpStatus.js";
import Configs from "../models/Configs.js";
import { sendError, sendSuccess } from "../utils/responses.js";

export const getMaintenance = async (req, res) => {
    try {
        const maintenance = await Configs.findOne({ type: 'Maintenance' })
        res.status(OK).send(
            sendSuccess({
                status: true,
                message: 'Maintenance status fetched successfully',
                data: maintenance
            })
        )
    }
    catch (error) {
        res.status(404).json(sendError({ message: error.message }));
    }
}