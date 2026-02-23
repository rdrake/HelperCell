FROM python:3.11-slim

USER root

RUN apt-get update -y

RUN apt-get install -y nodejs npm python3-pip python3-dev build-essential

WORKDIR /helpercell

RUN pip install jupyterlab 
RUN pip install flask 
RUN pip install flask-cors 
RUN pip install jupyter-server-proxy
RUN npm install jquery
RUN npm install --save-dev @types/jquery
RUN npm install firebase

COPY . .

WORKDIR /helpercell/server
RUN pip install google-genai
ENV FLASK_APP=app.py

WORKDIR /helpercell

RUN jlpm install

RUN jlpm run build

RUN jupyter labextension develop . --overwrite

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 8888
EXPOSE 5000

CMD ["/entrypoint.sh"]