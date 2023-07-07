"""
haimtran basic rds db connect
02/11/2022
"""
import os
import time
from datetime import datetime
import json
import mysql.connector
import boto3

# get region and secrete from enviornment variables 
try:
    SECRET_ID = os.environ["SECRET_ID"]
except: 
    SECRET_ID = "rds-secrete-name"

try:
    REGION = os.environ["REGION"]
except: 
    REGION = "ap-southeast-1"

# parameter for thread
NUM_ROW = 10000
CHUNK_SIZE = 100
NUM_THREAD_WORKER = 100
# table name
TABLE_NAME = "employees"


def get_db_credentials_from_config():
    """
    get db credentials from config.json
    """
    with open("config.json", "r", encoding="utf-8") as file:
        config = json.load(file)
    return config


def get_db_credentials_from_sm():
    """
    retrieve db credentials from secrete manager
    """
    # sm client
    secrete_client = boto3.client("secretsmanager", region_name=REGION)
    # get secret string
    try:
        resp = secrete_client.get_secret_value(SecretId=SECRET_ID)
        credentials = json.loads(resp["SecretString"])
        print(credentials)
    except:
        print("error retrieving secret manager")
        credentials = None
    # return
    return credentials


def get_connect():
    """
    test connecting to db endpoint
    """
    # get db credentials
    credentials = get_db_credentials_from_sm()
    # connector
    try:
        conn = mysql.connector.connect(
            host=credentials["host"],
            user=credentials["username"],
            password=credentials["password"],
            database=credentials["dbname"],
        )
        print("connected db: {0} at {1}".format(conn, datetime.now().strftime("%D, %H:%M:%S")))
    except:
        print("error connect to db")
    return conn


def check_db_connect():
    """
    keep pooling the db connection
    """
    while(True):
        get_connect()
        time.sleep(3)



if __name__ == "__main__":
    get_db_credentials_from_config()
    # get_db_credentials_from_sm()
    # get_connect()
    check_db_connect()
