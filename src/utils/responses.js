import { config } from "../config/default.js";
import { encrypt } from "./encryption.js";

export const sendSuccess = ({ status, message, data, token, count = null }) => {
  const ENCRYPTION_ENABLED = process.env.ENCRYPTION_ENABLED === "true"
  if (token) {
    return {
      status,
      message,
      token,
      data: ENCRYPTION_ENABLED ? encrypt(data) : data,
    };
  } else if (count) {
    return {
      status,
      message,
      data: ENCRYPTION_ENABLED ? encrypt(data) : data,
      count,
    };
  } else {
    return {
      status,
      message,
      data: ENCRYPTION_ENABLED ? encrypt(data) : data,
    };
  }
};
export const sendError = ({ status, message, error }) => {
  if (config.nodeEnv === 'production') {
    return {
      status,
      message,
      data: null,
      errorCode: error,
    };
  }
  return {
    status,
    message,
    data: null,
    stackTrace: error,
  };
};
