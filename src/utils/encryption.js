// const CryptoJS = require('crypto-js');
import CryptoJS from "crypto-js"
const SECRET_KEY = process.env.CRYPTO_SECRET_KEY; // Store this securely, perhaps as an environment variable

const encrypt = (data) => {
    return CryptoJS.AES.encrypt(JSON.stringify(data), SECRET_KEY).toString();
};

const decrypt = (ciphertext) => {
    const bytes = CryptoJS.AES.decrypt(ciphertext, SECRET_KEY);
    return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
};

export { encrypt, decrypt };