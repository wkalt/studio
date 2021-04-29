FROM node:14

RUN curl -fsSL https://packagecloud.io/install/repositories/github/git-lfs/script.deb.sh | bash \
  && apt-get install -qq git-lfs \
  && git lfs install \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /src
CMD bash
