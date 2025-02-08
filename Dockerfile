FROM node:18

WORKDIR /usr/src/app

COPY . .

RUN yarn

EXPOSE 5003

CMD [ "npm", "start" ]
