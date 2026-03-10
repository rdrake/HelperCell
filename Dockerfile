# ---------------------------------------------------------------------------
# Build stage — compile the JupyterLab extension into a wheel
# ---------------------------------------------------------------------------
ARG Z2JH_VERSION=4.3.2

FROM python:3.12-bookworm AS build-stage

RUN apt-get update && apt-get install -y --no-install-recommends nodejs npm \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /build

RUN pip install --no-cache-dir build "jupyterlab>=4.0.0,<5" hatchling \
    hatch-nodejs-version "hatch-jupyter-builder>=0.5"

COPY package.json yarn.lock .yarnrc.yml tsconfig.json setup.py pyproject.toml install.json LICENSE README.md ./
COPY schema schema
COPY style style
COPY src src
COPY feedback feedback

RUN jlpm install
RUN pip wheel --no-deps --wheel-dir=/tmp/wheels .

# ---------------------------------------------------------------------------
# Local dev — JupyterHub + singleuser in one image
# ---------------------------------------------------------------------------
FROM quay.io/jupyterhub/jupyterhub:5 AS hub

RUN pip install --no-cache-dir \
    jupyterhub-nativeauthenticator \
    jupyterlab \
    notebook \
    jupyter-server-proxy

COPY --from=build-stage /tmp/wheels/*.whl /tmp/wheels/
RUN pip install --no-cache-dir /tmp/wheels/feedback-*.whl && rm -rf /tmp/wheels

CMD ["jupyterhub", "-f", "/srv/jupyterhub/jupyterhub_config.py"]

# ---------------------------------------------------------------------------
# Production — singleuser image for z2jh
# ---------------------------------------------------------------------------
ARG Z2JH_VERSION
FROM quay.io/jupyterhub/k8s-singleuser-sample:${Z2JH_VERSION} AS singleuser

USER root

COPY --from=build-stage /tmp/wheels/*.whl /tmp/wheels/
RUN pip install --no-cache-dir \
        jupyter-server-proxy \
        /tmp/wheels/feedback-*.whl \
 && rm -rf /tmp/wheels

USER ${NB_USER}
