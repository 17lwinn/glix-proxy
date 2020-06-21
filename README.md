# Glix

Skip to [Local Development](#local-development).

## Local Development

## Download

```sh
git clone git@ihacks.dev:ihack2712/glix-open-source && cd glix
```

## Node modules

Use Yarn!

```sh
yarn install
```

## Starting a development server.

This requires two different shells, or two different terminals or tabs.

Shell 1.
```sh
yarn source:compile:watch
```

Shell 2.
```sh
export MONGO=mongodb://127.0.0.1:27017; export CADDY=http://127.0.0.1:2019; yarn build:start:watch
```
