import { decrypt } from "../utils/encryption.js";
import { isNotEmptyObject } from "../utils/index.js";

export function decryptMiddleware(req, res, next) {
  const ENCRYPTION_ENABLED = process.env.ENCRYPTION_ENABLED === "true"
  if (req?.body?.request) {
    try {
      const decryptedData = ENCRYPTION_ENABLED ? decrypt(req.body.request) : req.body.request;
      req.body = decryptedData;
    } catch (error) {
      return res.status(400).json({ error: 'Invalid encrypted data' });
    }
  }
  next();
}