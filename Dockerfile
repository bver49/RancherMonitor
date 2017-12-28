FROM mhart/alpine-node:6

WORKDIR /src
ADD . /src

RUN apk update

ENV PATH /root/.yarn/bin:$PATH

RUN apk update \
  && apk add curl bash binutils tar \
  && rm -rf /var/cache/apk/* \
  && curl -o- -L https://yarnpkg.com/install.sh | sh \
  && apk del curl tar binutils

RUN apk add --no-cache make gcc g++ git python

RUN yarn 

CMD ["npm", "start"]
