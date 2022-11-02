#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import {
  DatabaseStack,
  NetworkStack,
  RoleForEc2,
  WebServerStack,
} from "../lib/rds-failover-demo-stack";

const app = new cdk.App();

// network stack
const networkStack = new NetworkStack(app, "NetworkStack", {
  cidr: "172.16.0.0/20",
  env: {
    region: "ap-northeast-1",
    account: process.env.CDK_DEFAULT_ACCOUNT,
  },
});

// role for ec2 webserver
const roleStack = new RoleForEc2(app, "RoleForEc2Stack", {
  env: {
    region: "ap-northeast-1",
    account: process.env.CDK_DEFAULT_ACCOUNT,
  },
});

// database
const databaseStack = new DatabaseStack(app, "DatabaseStack", {
  vpc: networkStack.vpc,
  sg: networkStack.databaseSG,
  env: {
    region: "ap-northeast-1",
    account: process.env.CDK_DEFAULT_ACCOUNT,
  },
});

// webserver ec2
const webServerStack = new WebServerStack(app, "WebServerStack", {
  vpc: networkStack.vpc,
  sg: networkStack.webServerSG,
  role: roleStack.role,
  env: {
    region: "ap-northeast-1",
    account: process.env.CDK_DEFAULT_ACCOUNT,
  },
});

databaseStack.addDependency(networkStack);
webServerStack.addDependency(networkStack);
webServerStack.addDependency(roleStack);
