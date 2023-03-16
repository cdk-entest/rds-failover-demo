---
title: basic rds and multi-az failover handle
author: haimtran
description: basic rds and multi-az failover
publishedDate: 02/11/2022
date: 02/11/2022
---

## Introduction

[Github](https://github.com/cdk-entest/rds-failover-demo) shows basics of AWS RDS

- launch a RDS database instance
- test connector with credentials from secret manager or config.json
- read/write iops multi-thread
- launch a multi-az db and check failover handle
- please ensure having enough EIP address before deploy cdk

![Untitled Diagram](https://user-images.githubusercontent.com/20411077/199444773-42c3b7b0-2c36-4006-94c8-05b3fbd651f7.png)

## Create VPC

- create a vpc with at least two AZs
- one public, private, isolated subnet per each zone
- create security groups for rds

```ts
this.vpc = new aws_ec2.Vpc(this, "FabbiVpc", {
  vpcName: "fabbi",
  maxAzs: 2,
  cidr: props.cidr,
  subnetConfiguration: [
    {
      name: "public",
      subnetType: aws_ec2.SubnetType.PUBLIC,
      cidrMask: 24,
    },
    {
      name: "private-nat",
      subnetType: aws_ec2.SubnetType.PRIVATE_WITH_NAT,
      cidrMask: 24,
    },
    {
      name: "private-isolated",
      subnetType: aws_ec2.SubnetType.PRIVATE_ISOLATED,
      cidrMask: 24,
    },
  ],
});
```

create a security group for rds

```ts
const databaseSG = new aws_ec2.SecurityGroup(this, "DbSecurityGroup", {
  securityGroupName: "DbSecurityGroup",
  vpc: this.vpc,
});
databaseSG.addIngressRule(
  aws_ec2.Peer.securityGroupId(webServerSG.securityGroupId),
  aws_ec2.Port.tcp(3306)
);
databaseSG.addIngressRule(
  aws_ec2.Peer.securityGroupId(webServerSG.securityGroupId),
  aws_ec2.Port.tcp(1403)
);
```

create webserver security group

```ts
const webServerSG = new aws_ec2.SecurityGroup(this, "WebServerSecurityGroup", {
  securityGroupName: "WebServerSecurityGroup",
  vpc: this.vpc,
});
```

## Create a RDS

- enable multi-az so there is a standby instance in another zone

```ts
new aws_rds.DatabaseInstance(this, "RdsDatabaseInstance", {
  databaseName: "covid",
  deletionProtection: false,
  // enable multiAz so there is a standby one
  multiAz: true,
  engine: aws_rds.DatabaseInstanceEngine.mysql({
    version: aws_rds.MysqlEngineVersion.VER_8_0_23,
  }),
  vpc: props.vpc,
  port: 3306,
  instanceType: aws_ec2.InstanceType.of(
    aws_ec2.InstanceClass.BURSTABLE3,
    aws_ec2.InstanceSize.MEDIUM
  ),
  credentials: aws_rds.Credentials.fromGeneratedSecret("admin", {
    secretName: "rds-secrete-name",
  }),
  iamAuthentication: false,
  removalPolicy: RemovalPolicy.DESTROY,
  securityGroups: [props.sg],
  storageEncrypted: false,
  vpcSubnets: {
    subnetType: aws_ec2.SubnetType.PRIVATE_WITH_NAT,
  },
});
```

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

## Insert/Read Employees

create an employee table

```py
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
```

write some random data to the table

```py
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
```

fetch data for the flask web app

```py
def fetch_data():
    """
    create a rds table
    """
    # table data
    employees = []
    # init
    outputs = []
    # connect
    conn = conect_db()
    # cursor
    cur = conn.cursor()
    # query
    stmt_select = "SELECT id, name, age, time FROM employees ORDER BY id LIMIT 1000"
    cur.execute(stmt_select)
    # parse
    for row in cur.fetchall():
        outputs.append(row)
        print(row)

    # item object
    for output in outputs:
        employees.append(Item(output[0], output[1], output[2], output[3]))

    # close connect
    cur.close()
    conn.close()
    # return
    return ItemTable(employees)
```

## Test Failover

connect and play with the database 

```bash 
mysql --host=$host --user=$user --password=$password
```

you will see DNS of the database endpoint changes after reboot (click the failover box and rds multi-az assumed enlabed before)

```bash
while true; do host database-1.cxa01z0gy4dn.ap-northeast-1.rds.amazonaws.com; sleep 3;  done;
```

## Reference

- [rds under the hood](https://aws.amazon.com/blogs/database/amazon-rds-under-the-hood-multi-az/)
- [mysql docs](https://dev.mysql.com/doc/refman/8.0/en/database-use.html)
- [aws rds reboot](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_RebootInstance.html)
- [rds multi-az cluster](https://aws.amazon.com/blogs/database/readable-standby-instances-in-amazon-rds-multi-az-deployments-a-new-high-availability-option/)
