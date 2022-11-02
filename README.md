---
title: basic rds and multi-az failover handle
author: haimtran
description: basic rds and multi-az failover
publishedDate: 02/11/2022
date: 02/11/2022
---

## Introduction

- launch a RDS database instance
- test connector with credentials from secret manager
- read/write iops multi-thread
- launch a multi-az db and check failover handle

## Install DB CLI

```bash
sudo yum install mariadb
```

connect via terminal

```bash
mysql --version
```

```bash
mysql -h $ENDPOINT -P 3306 -u $USER -p
```

show databases

```bash
show databases
```

create a table

```bash

```

insert data into a table

```bash

```

## Python Connector

save database configuration in a config.json or retrieve from secrete manager service

```json
{
  "host": "",
  "username": "",
  "password": "",
  "dbname": ""
}
```

install dependencies

```bash
python3 -m pip install -r requirements.txt
```

requirements.txt

```txt
mysql-connector-python==8.0.30
names==0.3.0
boto3==1.26.0
```

retrieve datbase credentials from secrete manager service

```py
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
```

create a connector

```py
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
```

then create a table and write/read data using thread
