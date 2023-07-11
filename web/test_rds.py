# ===============================================================
# author: haimtran  | created date: 06/06/2023
# +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
# update 1          | created date: 06/07/2023
# get secrete and region from environment variables
# ===============================================================

import os 
import datetime
import mysql.connector
import boto3
import json
import names
import random

# get region and secrete from enviornment variables 
try:
    SECRET_ID = os.environ["SECRET_ID"]
except: 
    SECRET_ID = "rds-secrete-name"

try:
    REGION = os.environ["REGION"]
except: 
    REGION = "us-east-2"

# number of random employees 
NUM_EMPLOYEE = 10000
# sm client
secrete_client = boto3.client("secretsmanager", region_name=REGION)
# get secret string
secret = secrete_client.get_secret_value(SecretId=SECRET_ID)
# parse db information
secret_dic = json.loads(secret["SecretString"])
print(secret_dic)

# db connector
conn = mysql.connector.connect(
    host=secret_dic["host"],
    user=secret_dic["username"],
    port=secret_dic["port"],
    password=secret_dic["password"],
    database=secret_dic["dbname"],
)
print(f"SUCCESSFULLY CONNECTED TO DB {conn}")


def create_table() -> None:
    """
    create a rds table
    """
    # cursor
    cur = conn.cursor()
    # drop table if exists
    drop = "DROP TABLE IF EXISTS employees"
    cur.execute(drop)
    # create table
    employee_table = (
        "CREATE TABLE employees ("
        "    id INT UNSIGNED NOT NULL AUTO_INCREMENT, "
        "    name VARCHAR(30) DEFAULT '' NOT NULL, "
        "    age TEXT, "
        "    time TEXT, "
        "PRIMARY KEY (id))"
    )
    cur.execute(employee_table)
    # time stamp
    now = datetime.datetime.now()
    time_stamp = now.strftime("%Y/%m/%d-%H:%M:%S.%f")
    # employees (id, name, age, time)
    employees = [
        (k, names.get_full_name(), random.randint(20, 100), time_stamp)
        for k in range(1, NUM_EMPLOYEE)
    ]
    # tuple
    employees = tuple(employees)
    stmt_insert = "INSERT INTO employees (id, name, age, time) VALUES (%s, %s, %s, %s)"
    cur.executemany(stmt_insert, employees)
    conn.commit()
    # show table
    cur.execute("SHOW TABLES")
    tables = cur.fetchall()
    for table in tables:
        print(f"table: {table}")
    # close connect
    cur.close()
    conn.close()


def fetch_data():
    """
    fetch data
    """
    # init
    outputs = []
    #
    cur = conn.cursor()
    #
    stmt_select = "SELECT id, name, age, time FROM employees ORDER BY id"
    cur.execute(stmt_select)
    # parse
    for row in cur.fetchall():
        print(row)
    # return
    return outputs


def drop_table() -> None:
    """
    drop table
    """
    # cursor
    cur = conn.cursor()
    # drop table if exists
    drop = "DROP TABLE IF EXISTS employees"
    # execute
    cur.execute(drop)
    #
    print("DELETED TABLE")


if __name__ == "__main__":
    create_table()
    # fetch_data()
    # drop_table()
