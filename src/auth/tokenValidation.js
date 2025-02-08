import pkg from 'jsonwebtoken';
import Users from '../models/Register.js';
import { config } from '../config/default.js';

const { verify } = pkg;

export const validateToken = async (req, res, next) => {
  let token;
  const { authorization } = req.headers;
  if (authorization && authorization.startsWith('Bearer')) {
    try {
      // Get Token from header
      token = authorization.split(' ')[1];
      // Verify Token
      const { result } = verify(token, config.jwtSecretKey);
      // Get User from Token
      req.user = result;
      next();
    } catch (error) {
      res.status(401).send({ status: 'failed', message: 'Unauthorized User' });
    }
  }
  if (!token) {
    res
      .status(401)
      .send({ status: 'failed', message: 'Unauthorized User, No Token' });
  }
};

export const checkToken = async (req, res, next) => {
  let token;
  const { authorization } = req.headers;
  if (authorization && authorization.startsWith('Bearer')) {
    try {
      // Get Token from header
      token = authorization.split(' ')[1];
      // Verify Token
      const { result } = verify(token, config.jwtSecretKey);
      // Get User from Token
      req.user = result;
      next();
    } catch (error) {
      res.status(401).send({ status: 'failed', message: 'Unauthorized User' });
    }
  }
  if (!token) {
    console.log('no login user');
    next();
  }
};
