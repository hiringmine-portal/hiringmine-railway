import pkg from 'jsonwebtoken';
import { config } from '../config/default.js';

const { sign, verify } = pkg;

const jwtSecretKey = config.jwtSecretKey;

export const GenerateToken = ({ data, expiresIn }) => {
  //make the key more harder
  //expires in should also be from .env file
  //good approach
  return sign({ result: data }, jwtSecretKey, {
    expiresIn: expiresIn,
  });
};

export const VerifyToken = (token) => {
  return verify(token, jwtSecretKey);
};

export const ValidateToken = ({ token, key }) => {
  return verify(token, key);
};
