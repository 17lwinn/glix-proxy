FROM node:lts-alpine
LABEL maintainer="Richard O. Sandberg <richard@ihacks.dev>"

COPY ./package.json ./tsconfig.json ./yarn.lock /app/
COPY ./src /app/src/

WORKDIR /app

RUN \
	yarn install \
	&& yarn source:compile \
	&& rm -rf ./tsconfig.json ./src \
	&& yarn install --prod --prefer-offline \
	&& rm -rf /app/yarn.lock

CMD [ "node", "/app/build/index.js" ]
