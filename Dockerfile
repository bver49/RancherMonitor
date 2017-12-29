FROM mhart/alpine-node:6

WORKDIR /src

ADD . .

RUN npm install

CMD ["npm", "start"]
