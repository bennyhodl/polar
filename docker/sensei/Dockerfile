FROM debian:stable-slim as sensei

RUN apt-get update \
    && apt-get -y install git gosu

WORKDIR /

RUN git clone https://github.com/L2-Technology/sensei.git

FROM node:16 as build-web-admin

COPY . .
COPY --from=sensei /sensei /sensei

WORKDIR /sensei

COPY . .

WORKDIR /sensei/web-admin
RUN npm install
RUN npm run build

FROM rust:1.56 as build-sensei

WORKDIR /sensei

# copy your source tree
COPY . .

COPY --from=build-web-admin /sensei/web-admin/build/ /sensei/web-admin/build/
COPY --from=sensei /sensei /sensei

RUN rustup component add rustfmt

RUN cargo build --verbose --release

# our final base
FROM rust:1.56

# copy the build artifact from the build stage
COPY --from=build-sensei /sensei/target/release/senseid .

COPY docker-entrypoint.sh /entrypoint.sh

RUN chmod a+x /entrypoint.sh

VOLUME ["home/sensei/.sensei"]

EXPOSE 9735 5041

ENTRYPOINT [ "/entrypoint.sh" ]

# set the startup command to run your binary
CMD ["./senseid"]