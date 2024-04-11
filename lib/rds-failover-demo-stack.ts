import {
  aws_ec2,
  aws_rds,
  RemovalPolicy,
  Stack,
  StackProps,
  aws_iam,
  Duration,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import * as fs from "fs";

interface NetworkProps extends StackProps {
  cidr: string;
}
export class NetworkStack extends Stack {
  public readonly vpc: aws_ec2.Vpc;
  public readonly databaseSG: aws_ec2.SecurityGroup;
  public readonly webServerSG: aws_ec2.SecurityGroup;
  public readonly replicaSG: aws_ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: NetworkProps) {
    super(scope, id, props);

    this.vpc = new aws_ec2.Vpc(this, "NICVVpc", {
      vpcName: "NICV",
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

    // vpc endpoint for secret manager
    // this.vpc.addInterfaceEndpoint("SecreteManagerVpcEndpoint", {
    //   service: aws_ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
    //   privateDnsEnabled: true,
    //   subnets: {
    //     subnetType: aws_ec2.SubnetType.PRIVATE_ISOLATED,
    //   },
    // });

    this.vpc.addInterfaceEndpoint("SecreteManagerVpcEndpoint", {
      service: aws_ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
      privateDnsEnabled: true,
      subnets: {
        subnetType: aws_ec2.SubnetType.PRIVATE_WITH_NAT,
      },
    });

    // security group for webserver
    const webServerSG = new aws_ec2.SecurityGroup(
      this,
      "WebServerSecurityGroup",
      {
        securityGroupName: "WebServerSecurityGroup",
        vpc: this.vpc,
      }
    );
    webServerSG.addIngressRule(aws_ec2.Peer.anyIpv4(), aws_ec2.Port.tcp(80));
    webServerSG.addIngressRule(aws_ec2.Peer.anyIpv4(), aws_ec2.Port.tcp(22));

    // security group for db
    const databaseSG = new aws_ec2.SecurityGroup(this, "DbSecurityGroup", {
      securityGroupName: "DbSecurityGroup",
      vpc: this.vpc,
    });

    // open 3306 for web server
    databaseSG.addIngressRule(
      aws_ec2.Peer.securityGroupId(webServerSG.securityGroupId),
      aws_ec2.Port.tcp(3306)
    );

    // open 1403 for web server
    databaseSG.addIngressRule(
      aws_ec2.Peer.securityGroupId(webServerSG.securityGroupId),
      aws_ec2.Port.tcp(1403)
    );

    // self reference security group
    databaseSG.addIngressRule(databaseSG, aws_ec2.Port.tcp(1403));

    // database read replica security group
    const replicaSG = new aws_ec2.SecurityGroup(
      this,
      "DbReplicaSecurityGroup",
      {
        securityGroupName: "DbReplicaSecurityGroup",
        vpc: this.vpc,
      }
    );

    replicaSG.addIngressRule(aws_ec2.Peer.anyIpv4(), aws_ec2.Port.tcp(3306));
    replicaSG.addIngressRule(aws_ec2.Peer.anyIpv4(), aws_ec2.Port.tcp(1403));

    this.databaseSG = databaseSG;
    this.webServerSG = webServerSG;
    this.replicaSG = replicaSG;
  }
}

interface DatabaseProps extends StackProps {
  vpc: aws_ec2.Vpc;
  dbSG: aws_ec2.SecurityGroup;
  replicaSG: aws_ec2.SecurityGroup;
}
export class DatabaseStack extends Stack {
  constructor(scope: Construct, id: string, props: DatabaseProps) {
    super(scope, id, props);

    const db = new aws_rds.DatabaseInstance(this, "RdsDatabaseInstance", {
      databaseName: "covid",
      deletionProtection: false,
      // enable multiAz so there is a standby one
      multiAz: true,
      engine: aws_rds.DatabaseInstanceEngine.mysql({
        // version depends on region
        //version: aws_rds.MysqlEngineVersion.VER_8_0_23,
        version: aws_rds.MysqlEngineVersion.VER_8_0_28,
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
      securityGroups: [props.dbSG],
      storageEncrypted: false,
      vpcSubnets: {
        subnetType: aws_ec2.SubnetType.PRIVATE_WITH_NAT,
      },
    });

    const replica = new aws_rds.DatabaseInstanceReadReplica(
      this,
      "DatabaseInstanceReadReplicaDemo",
      {
        sourceDatabaseInstance: db,
        instanceType: aws_ec2.InstanceType.of(
          aws_ec2.InstanceClass.BURSTABLE2,
          aws_ec2.InstanceSize.MEDIUM
        ),
        vpc: props.vpc,
        removalPolicy: RemovalPolicy.DESTROY,
        securityGroups: [props.replicaSG],
        port: 3306,
        vpcSubnets: {
          subnetType: aws_ec2.SubnetType.PUBLIC,
        },
        storageEncrypted: false,
        backupRetention: Duration.days(7),
        deleteAutomatedBackups: true,
        deletionProtection: false,
        publiclyAccessible: true,
        // availabilityZone: ""
      }
    );
  }
}

interface RoleEc2Props extends StackProps {
  vpc: aws_ec2.Vpc;
}

export class RoleForEc2 extends Stack {
  public readonly role: aws_iam.Role;
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    const role = new aws_iam.Role(this, "RoleForEc2AccessRdsRedisDemo", {
      roleName: "RoleForEc2AccessRdsRedisDemo",
      assumedBy: new aws_iam.ServicePrincipal("ec2.amazonaws.com"),
    });

    role.addManagedPolicy(
      aws_iam.ManagedPolicy.fromAwsManagedPolicyName(
        "AmazonSSMManagedInstanceCore"
      )
    );

    role.addManagedPolicy(
      aws_iam.ManagedPolicy.fromAwsManagedPolicyName(
        "AWSCloudFormationReadOnlyAccess"
      )
    );

    role.attachInlinePolicy(
      new aws_iam.Policy(this, "PolicyForEc2AccessRdsRedisDemo", {
        policyName: "PolicyForEc2AccessRdsRedisDemo",
        statements: [
          new aws_iam.PolicyStatement({
            effect: aws_iam.Effect.ALLOW,
            actions: ["secretsmanager:GetSecretValue"],
            resources: ["arn:aws:secretsmanager:*"],
          }),
        ],
      })
    );

    this.role = role;
  }
}

interface WebServerProps extends StackProps {
  vpc: aws_ec2.Vpc;
  sg: aws_ec2.SecurityGroup;
  role: aws_iam.Role;
}

export class WebServerStack extends Stack {
  constructor(scope: Construct, id: string, props: WebServerProps) {
    super(scope, id, props);

    const ec2 = new aws_ec2.Instance(this, "Ec2RdsRedisDemo", {
      instanceName: "Ec2RdsRedisDemo",
      instanceType: aws_ec2.InstanceType.of(
        aws_ec2.InstanceClass.T3,
        aws_ec2.InstanceSize.SMALL
      ),
      machineImage: aws_ec2.MachineImage.latestAmazonLinux({
        generation: aws_ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
        edition: aws_ec2.AmazonLinuxEdition.STANDARD,
        storage: aws_ec2.AmazonLinuxStorage.GENERAL_PURPOSE,
      }),
      vpc: props.vpc,
      role: props.role,
      securityGroup: props.sg,
      vpcSubnets: {
        subnetType: aws_ec2.SubnetType.PUBLIC,
      },
    });

    // add user data for ec2
    ec2.addUserData(fs.readFileSync("./lib/user-data.sh", "utf8"));
  }
}
