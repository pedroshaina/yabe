FROM node:16

WORKDIR '/app'

COPY package*.json .

RUN yarn install

COPY . .

RUN chmod +x ./docker/entrypoint.sh

ENTRYPOINT [ "./docker/entrypoint.sh" ]