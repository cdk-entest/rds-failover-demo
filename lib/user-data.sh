export REGION=ap-southeast-1
export SECRET_ID=rds-secrete-name
yum install -y mariadb
wget https://github.com/cdk-entest/rds-failover-demo/archive/refs/heads/main.zip
unzip main.zip
cd rds-failover-demo-main
python3 -m pip install -r requirements.txt
cd web 
python3 test_rds.py 
python3 -m app 