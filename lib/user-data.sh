#!/bin/bash
# set environment variables 
export REGION=ap-southeast-1
export SECRET_ID=rds-secrete-name
# vim configuration 
wget -O ~/.vimrc https://raw.githubusercontent.com/cdk-entest/basic-vim/main/.vimrc
# install packages 
yum install -y mariadb
# download repository
wget https://github.com/cdk-entest/rds-failover-demo/archive/refs/heads/main.zip
unzip main.zip
cd rds-failover-demo-main
# install dependencies
python3 -m pip install -r requirements.txt
cd web 
# create table and data to database
python3 test_rds.py 
# run the flask app
python3 -m app 
