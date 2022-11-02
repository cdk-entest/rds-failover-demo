"""
haimtran basic rds db connect
02/11/2022
"""
import datetime
import json
import uuid
import logging as logger
from concurrent.futures import ThreadPoolExecutor
from threading import current_thread
import mysql.connector
import boto3

# region
REGION = "ap-northeast-1"
# secrete manager
SECRET_ID = "rds-secrete-name"
# set log level
logger.basicConfig(level=logger.DEBUG)
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
    conn = mysql.connector.connect(
        host=credentials["host"],
        user=credentials["username"],
        password=credentials["password"],
        database=credentials["dbname"],
    )
    return conn


def create_table() -> None:
    """
    create a rds table
    """
    # get connection
    conn = get_connect()
    # cursor
    cur = conn.cursor()
    # drop table if exists
    drop = "DROP TABLE IF EXISTS employees"
    cur.execute(drop)
    # create table
    employee_table = (
        "CREATE TABLE employees ("
        "    id VARCHAR(36) UNIQUE, "
        "    name VARCHAR(200) DEFAULT '' NOT NULL, "
        "    age INT, "
        "    time TEXT, "
        "PRIMARY KEY (id))"
    )
    cur.execute(employee_table)
    cur.close()
    conn.close()


def fetch_data():
    """
    fetch data
    """
    # get connection
    conn = get_connect()
    # output
    items = []
    # cursor connector
    cur = conn.cursor()
    #
    stmt_select = f"SELECT * FROM {TABLE_NAME} LIMIT 100"
    cur.execute(stmt_select)
    # parse
    for row in cur.fetchall():
        items.append(row)
        print(row)
    # close connection
    cur.close()
    conn.close()
    # return
    return items


def write_to_table():
    """
    write random data to table
    """
    # get connection
    conn = get_connect()
    conn.autocommit = True
    print(f"thread {current_thread().name} connect {conn}")
    cursor = conn.cursor()
    print(f"thread {current_thread().name} cursor {cursor}")
    for k in range(NUM_ROW):
        print(f"{current_thread().name} insert item {k}")
        stmt_insert = (
            "INSERT INTO employees (id, name, age, time) VALUES (%s, %s, %s, %s)"
        )
        cursor.execute(
            stmt_insert,
            (
                str(uuid.uuid4()),
                f"{str(uuid.uuid4())}-{str(uuid.uuid4())}",
                30,
                datetime.datetime.now().strftime("%Y-%M-%D-%H-%M-%S"),
            ),
        )
        if k % CHUNK_SIZE == 0:
            print(f"{current_thread().name} commit chunk {k // CHUNK_SIZE}")
            conn.commit()
    # close connection
    cursor.close()
    conn.close()


if __name__ == "__main__":
    # get_db_credentials_from_sm()
    # get_connect()
    # create_table()
    fetch_data()
