import * as cdk from '@aws-cdk/core';
import { Table, AttributeType } from "@aws-cdk/aws-dynamodb";
import { Function, AssetCode, Runtime } from '@aws-cdk/aws-lambda';
import { RestApi, LambdaIntegration, IResource, MockIntegration, PassthroughBehavior } from "@aws-cdk/aws-apigateway";
import { RetentionDays } from '@aws-cdk/aws-logs';
import * as codecommit from '@aws-cdk/aws-codecommit';
import * as codebuild from '@aws-cdk/aws-codebuild';
import * as codepipeline from '@aws-cdk/aws-codepipeline';
import * as codepipeline_actions from '@aws-cdk/aws-codepipeline-actions';
import * as iam from '@aws-cdk/aws-iam';
import * as s3 from '@aws-cdk/aws-s3';
import * as cloudfront from '@aws-cdk/aws-cloudfront';
import * as cognito from '@aws-cdk/aws-cognito';

//**************************************************** */
// 変数部分は自由に編集してください。
const stage = "dev"; // "stg","prd"
const bucketName = 'your-web-dev-bucket'
const projectName = 'myProject-' + stage; // ステージごとにリポジトリを作り分け可能
const repositoryName = 'my-cdk-repository' + stage;
const branch = 'master'; // 'release','master'; 
const pipelineName = 'myPipeline-' + stage;
const tableName = "MY_TABLE";
const restApiName = 'my-first-api';
//**************************************************** */

export class CdkTrainingStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    //**************************************************** */
    // S3バケットの作成
    //**************************************************** */

    const s3Bucket = new s3.Bucket(this, 's3-bucket-id', {
      bucketName: bucketName, // バケット名を定義
      websiteIndexDocument: 'test.html',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    })

    // Create OriginAccessIdentity
    const oai = new cloudfront.OriginAccessIdentity(this, "my-oai");

    // Create Policy and attach to mybucket
    const myBucketPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ["s3:GetObject"],
      principals: [
        new iam.CanonicalUserPrincipal(
          oai.cloudFrontOriginAccessIdentityS3CanonicalUserId
        ),
      ],
      resources: [s3Bucket.bucketArn + "/*"],
    });
    s3Bucket.addToResourcePolicy(myBucketPolicy);

    //**************************************************** */
    // CloudFrontの定義
    //**************************************************** */

    // Create CloudFront WebDistribution
    new cloudfront.CloudFrontWebDistribution(this, "WebsiteDistribution", {
      viewerCertificate: {
        aliases: [],
        props: {
          cloudFrontDefaultCertificate: true,
        },
      },
      priceClass: cloudfront.PriceClass.PRICE_CLASS_ALL,
      originConfigs: [
        {
          s3OriginSource: {
            s3BucketSource: s3Bucket,
            originAccessIdentity: oai,
          },
          behaviors: [
            {
              isDefaultBehavior: true,
              minTtl: cdk.Duration.seconds(0),
              maxTtl: cdk.Duration.days(365),
              defaultTtl: cdk.Duration.days(1),
              pathPattern: "/*", //ルート直下のファイルを全て参照
            },
          ],
        },
      ],
      errorConfigurations: [
        {
          errorCode: 403,
          responsePagePath: "/index.html",
          responseCode: 200,
          errorCachingMinTtl: 0,
        },
        {
          errorCode: 404,
          responsePagePath: "/index.html",
          responseCode: 200,
          errorCachingMinTtl: 0,
        },
      ],
    });

    //**************************************************** */
    // ビルドプロジェクトの作成
    //**************************************************** */
    const project = new codebuild.PipelineProject(this, 'project', {
      projectName: projectName,  // ビルドプロジェクトを定義
      description: 'some description',
      environment: {
        // 環境変数をbuildspec.ymlに設定
        environmentVariables: {
          S3_BUCKET_ARN: {
            type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
            value: s3Bucket.bucketArn,
          }
        },
      }
    });

    // S3へ資源反映するために、S3FullAccessRoleをcodeBuildへ付与
    project.addToRolePolicy(new iam.PolicyStatement({
      resources: [s3Bucket.bucketArn, s3Bucket.bucketArn + '/*'],
      actions: ['s3:*']
    }
    ));

    // パイプラインの生成
    const sourceOutput = new codepipeline.Artifact();
    //**************************************************** */
    // ソースアクションの作成
    //**************************************************** */

    // CodeCommitリポジトリの作成
    const repo = new codecommit.Repository(this, 'Repository', {
      repositoryName: repositoryName,
      description: 'Some description.', // optional property
    });

    const sourceAction = new codepipeline_actions.CodeCommitSourceAction({
      actionName: 'CodeCommit',
      repository: repo,
      branch: branch,
      output: sourceOutput,
    });

    //**************************************************** */
    // ビルドアクションの作成
    //**************************************************** */
    const buildAction = new codepipeline_actions.CodeBuildAction({
      actionName: 'CodeBuild',
      project,
      input: sourceOutput,
      outputs: [new codepipeline.Artifact()]
    });

    //**************************************************** */
    // パイプラインの作成
    //**************************************************** */
    new codepipeline.Pipeline(this, 'pipeline', {
      pipelineName: pipelineName,
      stages: [
        {
          stageName: 'Source',
          actions: [
            sourceAction
          ],
        },
        {
          stageName: 'Build',
          actions: [
            buildAction
          ],
        }
      ]
    })

    //**************************************************** */
    // DyanmoDBの作成
    //**************************************************** */
    const table: Table = new Table(this, "my-table-id", {
      partitionKey: {
        name: "meeting_id",
        type: AttributeType.NUMBER
      },
      sortKey: {
        name: "password",
        type: AttributeType.STRING
      },
      readCapacity: 1,
      writeCapacity: 1,
      tableName: tableName,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    //**************************************************** */
    //LambdaFunctionの作成
    //**************************************************** */
    const scanMeetingFunction: Function = new Function(this, 'scan-meeting', {
      functionName: 'scan-meeting',
      runtime: Runtime.NODEJS_12_X,
      code: AssetCode.fromAsset('src/lambda'),
      handler: 'scan-meeting.handler',
      timeout: cdk.Duration.seconds(10),
      environment: {
        TZ: "Asia/Tokyo",
        TABLE_NAME: table.tableName,
        CORS_URL: "*" //作成したCloudFrontのエンドポイントを指定する
      },
      logRetention: RetentionDays.TWO_MONTHS,
    });

    const registMeetingFunction: Function = new Function(this, 'regist-meeting', {
      functionName: 'regist-meetings',
      runtime: Runtime.NODEJS_12_X,
      code: AssetCode.fromAsset('src/lambda'),
      handler: 'regist-meeting.handler',
      timeout: cdk.Duration.seconds(10),
      environment: {
        TZ: "Asia/Tokyo",
        TABLE_NAME: table.tableName,
        CORS_URL: "*" //作成したCloudFrontのエンドポイントを指定する
      },
      logRetention: RetentionDays.TWO_MONTHS,
    });

    table.grantFullAccess(scanMeetingFunction);
    table.grantFullAccess(registMeetingFunction);

    //**************************************************** */
    // Cognitoユーザープール・アプリクライアントの作成
    //**************************************************** */
    const userPool: cognito.UserPool = new cognito.UserPool(this, 'your-user-pool-id', {
      userPoolName: "yourUserPoolName",
      // パスワードポリシー
      passwordPolicy: {
        // ４種８桁を定義
          minLength: 8,
          requireLowercase: true,
          requireDigits: true,
          requireUppercase: true,
          requireSymbols: false,
          tempPasswordValidity: cdk.Duration.days(7), // 仮パスワードの有効期限
      },
      selfSignUpEnabled: true,
      // 必須の標準属性やカスタム属性
      standardAttributes: {
        email: {
          required: true,
          mutable: true // 後に値を変更することを許可する
        },
        fullname: {
          required: true,
          mutable: true
        },
      },
      // Cognitoがユーザーのサインアップ時に自動的に確認するために調べる属性
      autoVerify: {
        email: true
      },
      // ユーザーがユーザープールに登録またはサインインする方法
      signInAliases: {
        email: true,
        username: true
      },
      // サインインエイリアスを大文字と小文字を区別して評価するかどうか
      signInCaseSensitive: true,
      // ユーザーは自分のアカウントをどのように回復できるか
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      // emailの設定
      // emailSettings: {
      //   from: '',
      //   replyTo: ''
      // },
      // 認証メール設定
      userVerification: {
        emailSubject: 'Your verification code',
        emailBody: 'Your verification code is {####}',
        emailStyle: cognito.VerificationEmailStyle.CODE,
      }
    });

    new cognito.UserPoolClient(this, 'your-user-pool-client-id', {
      userPoolClientName: 'yourAppClientName',
      userPool: userPool,
      // ユーザーによる認証を許可する
      authFlows: {
        refreshToken: true,
        userPassword: true,
        userSrp: true
      },
      // クライアントシークレットを生成する
      generateSecret: true,
      // クライアントがアプリと対話するためのOAuth設定
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
        },
        scopes: [cognito.OAuthScope.EMAIL],
      },
      // ユーザーがユーザープールに存在しない場合（false）、CognitoがUserNotFoundException例外を返すか、またはユーザーの不在を明らかにしない別のタイプのエラーを返すか
      preventUserExistenceErrors: true,
    });

    //**************************************************** */
    // API Gateway（リソース, メソッド）の作成
    //**************************************************** */
    const api = new RestApi(this, "schedule-manager-api", {
      restApiName: restApiName,
      cloudWatchRole: true,

    });
    const scanMeeting = api.root.addResource("scan-meeting");

    const scanMeetingLambdaIntegration = new LambdaIntegration(scanMeetingFunction);
    scanMeeting.addMethod("POST", scanMeetingLambdaIntegration);
    addCorsOptions(scanMeeting);

    const registMeeting = api.root.addResource("regist-meeting");

    const registMeetingLambdaIntegration = new LambdaIntegration(registMeetingFunction);
    registMeeting.addMethod("POST", registMeetingLambdaIntegration);
    addCorsOptions(registMeeting);
  }
}

//**************************************************** */
// API GatewayのメソッドにOPTIONを追加
//**************************************************** */
export function addCorsOptions(apiResource: IResource) {
  apiResource.addMethod(
    "OPTIONS",
    new MockIntegration({
      integrationResponses: [
        {
          statusCode: "200",
          responseParameters: {
            "method.response.header.Access-Control-Allow-Headers": "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent'",
            "method.response.header.Access-Control-Allow-Origin": "'*'",
            "method.response.header.Access-Control-Allow-Credentials": "'false'",
            "method.response.header.Access-Control-Allow-Methods": "'OPTIONS,GET,PUT,POST,DELETE'",
          },
        },
      ],
      passthroughBehavior: PassthroughBehavior.NEVER,
      requestTemplates: {
        "application/json": '{"statusCode": 200}',
      },
    }),
    {
      methodResponses: [
        {
          statusCode: "200",
          responseParameters: {
            "method.response.header.Access-Control-Allow-Headers": true,
            "method.response.header.Access-Control-Allow-Methods": true,
            "method.response.header.Access-Control-Allow-Credentials": true,
            "method.response.header.Access-Control-Allow-Origin": true,
          },
        },
      ],
    }
  );
}
