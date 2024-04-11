import {
  Duration,
  Stack,
  StackProps,
  aws_ec2,
  aws_iam,
  aws_lambda,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import * as path from "path";

interface LambdaRDSProxyProps extends StackProps {
  vpc: aws_ec2.Vpc;
  dbSecurityGroup: aws_ec2.SecurityGroup;
  secretId: string;
}

export class LambdaRDSProxyStack extends Stack {
  constructor(scope: Construct, id: string, props: LambdaRDSProxyProps) {
    super(scope, id, props);

    // create role for proxy to read rds
    const roleProxy = new aws_iam.Role(this, "RoleForRDSProxyDemo", {
      roleName: "RoleForRDSProxyDemo",
      assumedBy: new aws_iam.ServicePrincipal("rds.amazonaws.com"),
    });

    roleProxy.addManagedPolicy(
      aws_iam.ManagedPolicy.fromAwsManagedPolicyName("SecretsManagerReadWrite")
    );

    // create role for lambda vpc
    const roleLambda = new aws_iam.Role(this, "RoleForLambdaProxyRDS", {
      assumedBy: new aws_iam.ServicePrincipal("lambda.amazonaws.com"),
      roleName: "RoleForLambdaProxyRDS",
    });

    roleLambda.addManagedPolicy(
      aws_iam.ManagedPolicy.fromAwsManagedPolicyName("AWSLambdaExecute")
    );

    // no need
    roleLambda.addManagedPolicy(
      aws_iam.ManagedPolicy.fromAwsManagedPolicyName("SecretsManagerReadWrite")
    );

    roleLambda.addManagedPolicy(
      aws_iam.ManagedPolicy.fromManagedPolicyArn(
        this,
        "AWSLambdaVPCAccessExecutionRole",
        "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
      )
    );

    roleLambda.attachInlinePolicy(
      new aws_iam.Policy(this, "PolicyForLambdaAccessRdsVpc", {
        policyName: "PolicyForLambdaAccessRdsVpc",
        statements: [
          new aws_iam.PolicyStatement({
            effect: aws_iam.Effect.ALLOW,
            actions: ["rds:*"],
            resources: ["*"],
          }),
        ],
      })
    );

    // create role for lambda vpc
    new aws_lambda.Function(this, "LambdaRDSProxyDemo", {
      functionName: "LambdaRDSProxyDemo",
      runtime: aws_lambda.Runtime.PYTHON_3_8,
      code: aws_lambda.Code.fromAsset(
        path.join(__dirname, "./../lambda/package.zip")
      ),
      handler: "index.handler",
      timeout: Duration.seconds(10),
      memorySize: 256,
      role: roleLambda,
      vpc: props.vpc,
      vpcSubnets: {
        subnetType: aws_ec2.SubnetType.PRIVATE_WITH_NAT,
      },
      securityGroups: [props.dbSecurityGroup],
      environment: {
        SECRET_ID: props.secretId,
        REGION: this.region,
      },
    });
  }
}
