"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addCorsOptions = exports.CdkTempleteAdditionalEditionStack = void 0;
const cdk = require("@aws-cdk/core");
const aws_dynamodb_1 = require("@aws-cdk/aws-dynamodb");
const aws_lambda_1 = require("@aws-cdk/aws-lambda");
const aws_apigateway_1 = require("@aws-cdk/aws-apigateway");
const aws_logs_1 = require("@aws-cdk/aws-logs");
const codecommit = require("@aws-cdk/aws-codecommit");
const codebuild = require("@aws-cdk/aws-codebuild");
const codepipeline = require("@aws-cdk/aws-codepipeline");
const codepipeline_actions = require("@aws-cdk/aws-codepipeline-actions");
const iam = require("@aws-cdk/aws-iam");
const s3 = require("@aws-cdk/aws-s3");
const cloudfront = require("@aws-cdk/aws-cloudfront");
const cognito = require("@aws-cdk/aws-cognito");
//**************************************************** */
// buildspec.yamの中から、functionNameに対してdeployされる想定
const stage = "dev"; // "stg","prd"
const bucketName = 'your-web-dev-bucket';
//**************************************************** */
class CdkTempleteAdditionalEditionStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        //**************************************************** */
        // S3バケットの作成
        //**************************************************** */
        const s3Bucket = new s3.Bucket(this, 's3-bucket-id', {
            bucketName: bucketName,
            websiteIndexDocument: 'test.html',
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        // Create OriginAccessIdentity
        const oai = new cloudfront.OriginAccessIdentity(this, "my-oai");
        // Create Policy and attach to mybucket
        const myBucketPolicy = new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ["s3:GetObject"],
            principals: [
                new iam.CanonicalUserPrincipal(oai.cloudFrontOriginAccessIdentityS3CanonicalUserId),
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
                            pathPattern: "/*",
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
            projectName: 'yourProject-' + stage,
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
        }));
        // パイプラインの生成
        const sourceOutput = new codepipeline.Artifact();
        //**************************************************** */
        // ソースアクションの作成
        //**************************************************** */
        const repositoryName = 'your-cdk-repository';
        const branch = 'master'; // 'release','master';
        // CodeCommitリポジトリの作成
        const repo = new codecommit.Repository(this, 'Repository', {
            repositoryName: repositoryName,
            description: 'Some description.',
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
            pipelineName: 'myPipeline-' + stage,
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
        });
        //**************************************************** */
        // DyanmoDBの作成
        //**************************************************** */
        const table = new aws_dynamodb_1.Table(this, "SCHEDULE_MANAGER", {
            partitionKey: {
                name: "meeting_id",
                type: aws_dynamodb_1.AttributeType.NUMBER
            },
            sortKey: {
                name: "password",
                type: aws_dynamodb_1.AttributeType.STRING
            },
            readCapacity: 1,
            writeCapacity: 1,
            tableName: 'SCHEDULE_MANAGER',
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        //**************************************************** */
        //LambdaFunctionの作成
        //**************************************************** */
        const scanMeetingFunction = new aws_lambda_1.Function(this, 'scan-meeting', {
            functionName: 'scan-meeting',
            runtime: aws_lambda_1.Runtime.NODEJS_12_X,
            code: aws_lambda_1.AssetCode.fromAsset('src/lambda'),
            handler: 'scan-meeting.handler',
            timeout: cdk.Duration.seconds(10),
            environment: {
                TZ: "Asia/Tokyo",
                TABLE_NAME: table.tableName,
                CORS_URL: "https://d36dbqt35vqs6q.cloudfront.net/"
            },
            logRetention: aws_logs_1.RetentionDays.TWO_MONTHS,
        });
        const registMeetingFunction = new aws_lambda_1.Function(this, 'regist-meeting', {
            functionName: 'regist-meetings',
            runtime: aws_lambda_1.Runtime.NODEJS_12_X,
            code: aws_lambda_1.AssetCode.fromAsset('src/lambda'),
            handler: 'regist-meeting.handler',
            timeout: cdk.Duration.seconds(10),
            environment: {
                TZ: "Asia/Tokyo",
                TABLE_NAME: table.tableName,
                CORS_URL: "https://d36dbqt35vqs6q.cloudfront.net/"
            },
            logRetention: aws_logs_1.RetentionDays.TWO_MONTHS,
        });
        table.grantFullAccess(scanMeetingFunction);
        table.grantFullAccess(registMeetingFunction);
        //**************************************************** */
        // Cognitoユーザープール・アプリクライアントの作成
        //**************************************************** */
        const userPool = new cognito.UserPool(this, 'your-user-pool-id', {
            userPoolName: "yourUserPoolName",
            // パスワードポリシー
            passwordPolicy: {
                // ４種８桁を定義
                minLength: 8,
                requireLowercase: true,
                requireDigits: true,
                requireUppercase: true,
                requireSymbols: false,
                tempPasswordValidity: cdk.Duration.days(7),
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
                userPassword: true
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
        const api = new aws_apigateway_1.RestApi(this, "schedule-manager-api", {
            restApiName: "schedule-manager-api",
            cloudWatchRole: true,
        });
        const scanMeeting = api.root.addResource("scan-meeting");
        const scanMeetingLambdaIntegration = new aws_apigateway_1.LambdaIntegration(scanMeetingFunction);
        scanMeeting.addMethod("POST", scanMeetingLambdaIntegration);
        addCorsOptions(scanMeeting);
        const registMeeting = api.root.addResource("regist-meeting");
        const registMeetingLambdaIntegration = new aws_apigateway_1.LambdaIntegration(registMeetingFunction);
        registMeeting.addMethod("POST", registMeetingLambdaIntegration);
        addCorsOptions(registMeeting);
    }
}
exports.CdkTempleteAdditionalEditionStack = CdkTempleteAdditionalEditionStack;
//**************************************************** */
// API GatewayのメソッドにOPTIONを追加
//**************************************************** */
function addCorsOptions(apiResource) {
    apiResource.addMethod("OPTIONS", new aws_apigateway_1.MockIntegration({
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
        passthroughBehavior: aws_apigateway_1.PassthroughBehavior.NEVER,
        requestTemplates: {
            "application/json": '{"statusCode": 200}',
        },
    }), {
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
    });
}
exports.addCorsOptions = addCorsOptions;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2RrLXRlbXBsZXRlLWFkZGl0aW9uYWwtZWRpdGlvbi1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImNkay10ZW1wbGV0ZS1hZGRpdGlvbmFsLWVkaXRpb24tc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEscUNBQXFDO0FBQ3JDLHdEQUE2RDtBQUM3RCxvREFBbUU7QUFDbkUsNERBQXNIO0FBQ3RILGdEQUFrRDtBQUNsRCxzREFBc0Q7QUFDdEQsb0RBQW9EO0FBQ3BELDBEQUEwRDtBQUMxRCwwRUFBMEU7QUFDMUUsd0NBQXdDO0FBQ3hDLHNDQUFzQztBQUN0QyxzREFBc0Q7QUFDdEQsZ0RBQWdEO0FBRWhELHlEQUF5RDtBQUN6RCxnREFBZ0Q7QUFDaEQsTUFBTSxLQUFLLEdBQUcsS0FBSyxDQUFDLENBQUMsY0FBYztBQUNuQyxNQUFNLFVBQVUsR0FBRyxxQkFBcUIsQ0FBQTtBQUN4Qyx5REFBeUQ7QUFFekQsTUFBYSxpQ0FBa0MsU0FBUSxHQUFHLENBQUMsS0FBSztJQUM5RCxZQUFZLEtBQW9CLEVBQUUsRUFBVSxFQUFFLEtBQXNCO1FBQ2xFLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLHlEQUF5RDtRQUN6RCxZQUFZO1FBQ1oseURBQXlEO1FBRXpELE1BQU0sUUFBUSxHQUFHLElBQUksRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsY0FBYyxFQUFFO1lBQ25ELFVBQVUsRUFBRSxVQUFVO1lBQ3RCLG9CQUFvQixFQUFFLFdBQVc7WUFDakMsYUFBYSxFQUFFLEdBQUcsQ0FBQyxhQUFhLENBQUMsT0FBTztTQUN6QyxDQUFDLENBQUE7UUFFRiw4QkFBOEI7UUFDOUIsTUFBTSxHQUFHLEdBQUcsSUFBSSxVQUFVLENBQUMsb0JBQW9CLENBQUMsSUFBSSxFQUFFLFFBQVEsQ0FBQyxDQUFDO1FBRWhFLHVDQUF1QztRQUN2QyxNQUFNLGNBQWMsR0FBRyxJQUFJLEdBQUcs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b0QsRUFBRSxJQUFJO2lCQUMzRDthQUNGO1NBQ0Y7S0FDRixDQUNGLENBQUM7QUFDSixDQUFDO0FBbENELHdDQWtDQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdAYXdzLWNkay9jb3JlJztcbmltcG9ydCB7IFRhYmxlLCBBdHRyaWJ1dGVUeXBlIH0gZnJvbSBcIkBhd3MtY2RrL2F3cy1keW5hbW9kYlwiO1xuaW1wb3J0IHsgRnVuY3Rpb24sIEFzc2V0Q29kZSwgUnVudGltZSB9IGZyb20gJ0Bhd3MtY2RrL2F3cy1sYW1iZGEnO1xuaW1wb3J0IHsgUmVzdEFwaSwgTGFtYmRhSW50ZWdyYXRpb24sIElSZXNvdXJjZSwgTW9ja0ludGVncmF0aW9uLCBQYXNzdGhyb3VnaEJlaGF2aW9yIH0gZnJvbSBcIkBhd3MtY2RrL2F3cy1hcGlnYXRld2F5XCI7XG5pbXBvcnQgeyBSZXRlbnRpb25EYXlzIH0gZnJvbSAnQGF3cy1jZGsvYXdzLWxvZ3MnO1xuaW1wb3J0ICogYXMgY29kZWNvbW1pdCBmcm9tICdAYXdzLWNkay9hd3MtY29kZWNvbW1pdCc7XG5pbXBvcnQgKiBhcyBjb2RlYnVpbGQgZnJvbSAnQGF3cy1jZGsvYXdzLWNvZGVidWlsZCc7XG5pbXBvcnQgKiBhcyBjb2RlcGlwZWxpbmUgZnJvbSAnQGF3cy1jZGsvYXdzLWNvZGVwaXBlbGluZSc7XG5pbXBvcnQgKiBhcyBjb2RlcGlwZWxpbmVfYWN0aW9ucyBmcm9tICdAYXdzLWNkay9hd3MtY29kZXBpcGVsaW5lLWFjdGlvbnMnO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gJ0Bhd3MtY2RrL2F3cy1pYW0nO1xuaW1wb3J0ICogYXMgczMgZnJvbSAnQGF3cy1jZGsvYXdzLXMzJztcbmltcG9ydCAqIGFzIGNsb3VkZnJvbnQgZnJvbSAnQGF3cy1jZGsvYXdzLWNsb3VkZnJvbnQnO1xuaW1wb3J0ICogYXMgY29nbml0byBmcm9tICdAYXdzLWNkay9hd3MtY29nbml0byc7XG5cbi8vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiAqL1xuLy8gYnVpbGRzcGVjLnlhbeOBruS4reOBi+OCieOAgWZ1bmN0aW9uTmFtZeOBq+WvvuOBl+OBpmRlcGxveeOBleOCjOOCi+aDs+WumlxuY29uc3Qgc3RhZ2UgPSBcImRldlwiOyAvLyBcInN0Z1wiLFwicHJkXCJcbmNvbnN0IGJ1Y2tldE5hbWUgPSAneW91ci13ZWItZGV2LWJ1Y2tldCdcbi8vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiAqL1xuXG5leHBvcnQgY2xhc3MgQ2RrVGVtcGxldGVBZGRpdGlvbmFsRWRpdGlvblN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgY29uc3RydWN0b3Ioc2NvcGU6IGNkay5Db25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzPzogY2RrLlN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIC8vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiAqL1xuICAgIC8vIFMz44OQ44Kx44OD44OI44Gu5L2c5oiQXG4gICAgLy8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqICovXG5cbiAgICBjb25zdCBzM0J1Y2tldCA9IG5ldyBzMy5CdWNrZXQodGhpcywgJ3MzLWJ1Y2tldC1pZCcsIHtcbiAgICAgIGJ1Y2tldE5hbWU6IGJ1Y2tldE5hbWUsIC8vIOODkOOCseODg+ODiOWQjeOCkuWumue+qVxuICAgICAgd2Vic2l0ZUluZGV4RG9jdW1lbnQ6ICd0ZXN0Lmh0bWwnLFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICB9KVxuXG4gICAgLy8gQ3JlYXRlIE9yaWdpbkFjY2Vzc0lkZW50aXR5XG4gICAgY29uc3Qgb2FpID0gbmV3IGNsb3VkZnJvbnQuT3JpZ2luQWNjZXNzSWRlbnRpdHkodGhpcywgXCJteS1vYWlcIik7XG5cbiAgICAvLyBDcmVhdGUgUG9saWN5IGFuZCBhdHRhY2ggdG8gbXlidWNrZXRcbiAgICBjb25zdCBteUJ1Y2tldFBvbGljeSA9IG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgIGFjdGlvbnM6IFtcInMzOkdldE9iamVjdFwiXSxcbiAgICAgIHByaW5jaXBhbHM6IFtcbiAgICAgICAgbmV3IGlhbS5DYW5vbmljYWxVc2VyUHJpbmNpcGFsKFxuICAgICAgICAgIG9haS5jbG91ZEZyb250T3JpZ2luQWNjZXNzSWRlbnRpdHlTM0Nhbm9uaWNhbFVzZXJJZFxuICAgICAgICApLFxuICAgICAgXSxcbiAgICAgIHJlc291cmNlczogW3MzQnVja2V0LmJ1Y2tldEFybiArIFwiLypcIl0sXG4gICAgfSk7XG4gICAgczNCdWNrZXQuYWRkVG9SZXNvdXJjZVBvbGljeShteUJ1Y2tldFBvbGljeSk7XG5cbiAgICAvLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiogKi9cbiAgICAvLyBDbG91ZEZyb25044Gu5a6a576pXG4gICAgLy8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqICovXG5cbiAgICAvLyBDcmVhdGUgQ2xvdWRGcm9udCBXZWJEaXN0cmlidXRpb25cbiAgICBuZXcgY2xvdWRmcm9udC5DbG91ZEZyb250V2ViRGlzdHJpYnV0aW9uKHRoaXMsIFwiV2Vic2l0ZURpc3RyaWJ1dGlvblwiLCB7XG4gICAgICB2aWV3ZXJDZXJ0aWZpY2F0ZToge1xuICAgICAgICBhbGlhc2VzOiBbXSxcbiAgICAgICAgcHJvcHM6IHtcbiAgICAgICAgICBjbG91ZEZyb250RGVmYXVsdENlcnRpZmljYXRlOiB0cnVlLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIHByaWNlQ2xhc3M6IGNsb3VkZnJvbnQuUHJpY2VDbGFzcy5QUklDRV9DTEFTU19BTEwsXG4gICAgICBvcmlnaW5Db25maWdzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBzM09yaWdpblNvdXJjZToge1xuICAgICAgICAgICAgczNCdWNrZXRTb3VyY2U6IHMzQnVja2V0LFxuICAgICAgICAgICAgb3JpZ2luQWNjZXNzSWRlbnRpdHk6IG9haSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIGJlaGF2aW9yczogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBpc0RlZmF1bHRCZWhhdmlvcjogdHJ1ZSxcbiAgICAgICAgICAgICAgbWluVHRsOiBjZGsuRHVyYXRpb24uc2Vjb25kcygwKSxcbiAgICAgICAgICAgICAgbWF4VHRsOiBjZGsuRHVyYXRpb24uZGF5cygzNjUpLFxuICAgICAgICAgICAgICBkZWZhdWx0VHRsOiBjZGsuRHVyYXRpb24uZGF5cygxKSxcbiAgICAgICAgICAgICAgcGF0aFBhdHRlcm46IFwiLypcIiwgLy/jg6vjg7zjg4jnm7TkuIvjga7jg5XjgqHjgqTjg6vjgpLlhajjgablj4LnhadcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgXSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgICBlcnJvckNvbmZpZ3VyYXRpb25zOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBlcnJvckNvZGU6IDQwMyxcbiAgICAgICAgICByZXNwb25zZVBhZ2VQYXRoOiBcIi9pbmRleC5odG1sXCIsXG4gICAgICAgICAgcmVzcG9uc2VDb2RlOiAyMDAsXG4gICAgICAgICAgZXJyb3JDYWNoaW5nTWluVHRsOiAwLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgZXJyb3JDb2RlOiA0MDQsXG4gICAgICAgICAgcmVzcG9uc2VQYWdlUGF0aDogXCIvaW5kZXguaHRtbFwiLFxuICAgICAgICAgIHJlc3BvbnNlQ29kZTogMjAwLFxuICAgICAgICAgIGVycm9yQ2FjaGluZ01pblR0bDogMCxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICAvLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiogKi9cbiAgICAvLyDjg5Pjg6vjg4njg5fjg63jgrjjgqfjgq/jg4jjga7kvZzmiJBcbiAgICAvLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiogKi9cbiAgICBjb25zdCBwcm9qZWN0ID0gbmV3IGNvZGVidWlsZC5QaXBlbGluZVByb2plY3QodGhpcywgJ3Byb2plY3QnLCB7XG4gICAgICBwcm9qZWN0TmFtZTogJ3lvdXJQcm9qZWN0LScgKyBzdGFnZSwgIC8vIOODk+ODq+ODieODl+ODreOCuOOCp+OCr+ODiOOCkuWumue+qVxuICAgICAgZGVzY3JpcHRpb246ICdzb21lIGRlc2NyaXB0aW9uJyxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIC8vIOeSsOWig+WkieaVsOOCkmJ1aWxkc3BlYy55bWzjgavoqK3lrppcbiAgICAgICAgZW52aXJvbm1lbnRWYXJpYWJsZXM6IHtcbiAgICAgICAgICBTM19CVUNLRVRfQVJOOiB7XG4gICAgICAgICAgICB0eXBlOiBjb2RlYnVpbGQuQnVpbGRFbnZpcm9ubWVudFZhcmlhYmxlVHlwZS5QTEFJTlRFWFQsXG4gICAgICAgICAgICB2YWx1ZTogczNCdWNrZXQuYnVja2V0QXJuLFxuICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIFMz44G46LOH5rqQ5Y+N5pig44GZ44KL44Gf44KB44Gr44CBUzNGdWxsQWNjZXNzUm9sZeOCkmNvZGVCdWlsZOOBuOS7mOS4jlxuICAgIHByb2plY3QuYWRkVG9Sb2xlUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIHJlc291cmNlczogW3MzQnVja2V0LmJ1Y2tldEFybiwgczNCdWNrZXQuYnVja2V0QXJuICsgJy8qJ10sXG4gICAgICBhY3Rpb25zOiBbJ3MzOionXVxuICAgIH1cbiAgICApKTtcblxuICAgIC8vIOODkeOCpOODl+ODqeOCpOODs+OBrueUn+aIkFxuICAgIGNvbnN0IHNvdXJjZU91dHB1dCA9IG5ldyBjb2RlcGlwZWxpbmUuQXJ0aWZhY3QoKTtcbiAgICAvLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiogKi9cbiAgICAvLyDjgr3jg7zjgrnjgqLjgq/jgrfjg6fjg7Pjga7kvZzmiJBcbiAgICAvLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiogKi9cbiAgICBjb25zdCByZXBvc2l0b3J5TmFtZSA9ICd5b3VyLWNkay1yZXBvc2l0b3J5JztcbiAgICBjb25zdCBicmFuY2ggPSAnbWFzdGVyJzsgLy8gJ3JlbGVhc2UnLCdtYXN0ZXInO1xuXG4gICAgLy8gQ29kZUNvbW1pdOODquODneOCuOODiOODquOBruS9nOaIkFxuICAgIGNvbnN0IHJlcG8gPSBuZXcgY29kZWNvbW1pdC5SZXBvc2l0b3J5KHRoaXMsICdSZXBvc2l0b3J5Jywge1xuICAgICAgcmVwb3NpdG9yeU5hbWU6IHJlcG9zaXRvcnlOYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdTb21lIGRlc2NyaXB0aW9uLicsIC8vIG9wdGlvbmFsIHByb3BlcnR5XG4gICAgfSk7XG5cbiAgICBjb25zdCBzb3VyY2VBY3Rpb24gPSBuZXcgY29kZXBpcGVsaW5lX2FjdGlvbnMuQ29kZUNvbW1pdFNvdXJjZUFjdGlvbih7XG4gICAgICBhY3Rpb25OYW1lOiAnQ29kZUNvbW1pdCcsXG4gICAgICByZXBvc2l0b3J5OiByZXBvLFxuICAgICAgYnJhbmNoOiBicmFuY2gsXG4gICAgICBvdXRwdXQ6IHNvdXJjZU91dHB1dCxcbiAgICB9KTtcblxuICAgIC8vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiAqL1xuICAgIC8vIOODk+ODq+ODieOCouOCr+OCt+ODp+ODs+OBruS9nOaIkFxuICAgIC8vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiAqL1xuICAgIGNvbnN0IGJ1aWxkQWN0aW9uID0gbmV3IGNvZGVwaXBlbGluZV9hY3Rpb25zLkNvZGVCdWlsZEFjdGlvbih7XG4gICAgICBhY3Rpb25OYW1lOiAnQ29kZUJ1aWxkJyxcbiAgICAgIHByb2plY3QsXG4gICAgICBpbnB1dDogc291cmNlT3V0cHV0LFxuICAgICAgb3V0cHV0czogW25ldyBjb2RlcGlwZWxpbmUuQXJ0aWZhY3QoKV1cbiAgICB9KTtcblxuICAgIC8vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiAqL1xuICAgIC8vIOODkeOCpOODl+ODqeOCpOODs+OBruS9nOaIkFxuICAgIC8vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiAqL1xuICAgIG5ldyBjb2RlcGlwZWxpbmUuUGlwZWxpbmUodGhpcywgJ3BpcGVsaW5lJywge1xuICAgICAgcGlwZWxpbmVOYW1lOiAnbXlQaXBlbGluZS0nICsgc3RhZ2UsXG4gICAgICBzdGFnZXM6IFtcbiAgICAgICAge1xuICAgICAgICAgIHN0YWdlTmFtZTogJ1NvdXJjZScsXG4gICAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICAgc291cmNlQWN0aW9uXG4gICAgICAgICAgXSxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIHN0YWdlTmFtZTogJ0J1aWxkJyxcbiAgICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgICBidWlsZEFjdGlvblxuICAgICAgICAgIF0sXG4gICAgICAgIH1cbiAgICAgIF1cbiAgICB9KVxuXG4gICAgLy8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqICovXG4gICAgLy8gRHlhbm1vRELjga7kvZzmiJBcbiAgICAvLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiogKi9cbiAgICBjb25zdCB0YWJsZTogVGFibGUgPSBuZXcgVGFibGUodGhpcywgXCJTQ0hFRFVMRV9NQU5BR0VSXCIsIHtcbiAgICAgIHBhcnRpdGlvbktleToge1xuICAgICAgICBuYW1lOiBcIm1lZXRpbmdfaWRcIixcbiAgICAgICAgdHlwZTogQXR0cmlidXRlVHlwZS5OVU1CRVJcbiAgICAgIH0sXG4gICAgICBzb3J0S2V5OiB7XG4gICAgICAgIG5hbWU6IFwicGFzc3dvcmRcIixcbiAgICAgICAgdHlwZTogQXR0cmlidXRlVHlwZS5TVFJJTkdcbiAgICAgIH0sXG4gICAgICByZWFkQ2FwYWNpdHk6IDEsXG4gICAgICB3cml0ZUNhcGFjaXR5OiAxLFxuICAgICAgdGFibGVOYW1lOiAnU0NIRURVTEVfTUFOQUdFUicsXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgIH0pO1xuXG4gICAgLy8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqICovXG4gICAgLy9MYW1iZGFGdW5jdGlvbuOBruS9nOaIkFxuICAgIC8vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiAqL1xuICAgIGNvbnN0IHNjYW5NZWV0aW5nRnVuY3Rpb246IEZ1bmN0aW9uID0gbmV3IEZ1bmN0aW9uKHRoaXMsICdzY2FuLW1lZXRpbmcnLCB7XG4gICAgICBmdW5jdGlvbk5hbWU6ICdzY2FuLW1lZXRpbmcnLFxuICAgICAgcnVudGltZTogUnVudGltZS5OT0RFSlNfMTJfWCxcbiAgICAgIGNvZGU6IEFzc2V0Q29kZS5mcm9tQXNzZXQoJ3NyYy9sYW1iZGEnKSxcbiAgICAgIGhhbmRsZXI6ICdzY2FuLW1lZXRpbmcuaGFuZGxlcicsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygxMCksXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBUWjogXCJBc2lhL1Rva3lvXCIsXG4gICAgICAgIFRBQkxFX05BTUU6IHRhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgQ09SU19VUkw6IFwiaHR0cHM6Ly9kMzZkYnF0MzV2cXM2cS5jbG91ZGZyb250Lm5ldC9cIlxuICAgICAgfSxcbiAgICAgIGxvZ1JldGVudGlvbjogUmV0ZW50aW9uRGF5cy5UV09fTU9OVEhTLFxuICAgIH0pO1xuXG4gICAgY29uc3QgcmVnaXN0TWVldGluZ0Z1bmN0aW9uOiBGdW5jdGlvbiA9IG5ldyBGdW5jdGlvbih0aGlzLCAncmVnaXN0LW1lZXRpbmcnLCB7XG4gICAgICBmdW5jdGlvbk5hbWU6ICdyZWdpc3QtbWVldGluZ3MnLFxuICAgICAgcnVudGltZTogUnVudGltZS5OT0RFSlNfMTJfWCxcbiAgICAgIGNvZGU6IEFzc2V0Q29kZS5mcm9tQXNzZXQoJ3NyYy9sYW1iZGEnKSxcbiAgICAgIGhhbmRsZXI6ICdyZWdpc3QtbWVldGluZy5oYW5kbGVyJyxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDEwKSxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIFRaOiBcIkFzaWEvVG9reW9cIixcbiAgICAgICAgVEFCTEVfTkFNRTogdGFibGUudGFibGVOYW1lLFxuICAgICAgICBDT1JTX1VSTDogXCJodHRwczovL2QzNmRicXQzNXZxczZxLmNsb3VkZnJvbnQubmV0L1wiXG4gICAgICB9LFxuICAgICAgbG9nUmV0ZW50aW9uOiBSZXRlbnRpb25EYXlzLlRXT19NT05USFMsXG4gICAgfSk7XG5cbiAgICB0YWJsZS5ncmFudEZ1bGxBY2Nlc3Moc2Nhbk1lZXRpbmdGdW5jdGlvbik7XG4gICAgdGFibGUuZ3JhbnRGdWxsQWNjZXNzKHJlZ2lzdE1lZXRpbmdGdW5jdGlvbik7XG5cbiAgICAvLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiogKi9cbiAgICAvLyBDb2duaXRv44Om44O844K244O844OX44O844Or44O744Ki44OX44Oq44Kv44Op44Kk44Ki44Oz44OI44Gu5L2c5oiQXG4gICAgLy8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqICovXG4gICAgY29uc3QgdXNlclBvb2w6IGNvZ25pdG8uVXNlclBvb2wgPSBuZXcgY29nbml0by5Vc2VyUG9vbCh0aGlzLCAneW91ci11c2VyLXBvb2wtaWQnLCB7XG4gICAgICB1c2VyUG9vbE5hbWU6IFwieW91clVzZXJQb29sTmFtZVwiLFxuICAgICAgLy8g44OR44K544Ov44O844OJ44Od44Oq44K344O8XG4gICAgICBwYXNzd29yZFBvbGljeToge1xuICAgICAgICAvLyDvvJTnqK7vvJjmoYHjgpLlrprnvqlcbiAgICAgICAgICBtaW5MZW5ndGg6IDgsXG4gICAgICAgICAgcmVxdWlyZUxvd2VyY2FzZTogdHJ1ZSxcbiAgICAgICAgICByZXF1aXJlRGlnaXRzOiB0cnVlLFxuICAgICAgICAgIHJlcXVpcmVVcHBlcmNhc2U6IHRydWUsXG4gICAgICAgICAgcmVxdWlyZVN5bWJvbHM6IGZhbHNlLFxuICAgICAgICAgIHRlbXBQYXNzd29yZFZhbGlkaXR5OiBjZGsuRHVyYXRpb24uZGF5cyg3KSwgLy8g5Luu44OR44K544Ov44O844OJ44Gu5pyJ5Yq55pyf6ZmQXG4gICAgICB9LFxuICAgICAgc2VsZlNpZ25VcEVuYWJsZWQ6IHRydWUsXG4gICAgICAvLyDlv4XpoIjjga7mqJnmupblsZ7mgKfjgoTjgqvjgrnjgr/jg6DlsZ7mgKdcbiAgICAgIHN0YW5kYXJkQXR0cmlidXRlczoge1xuICAgICAgICBlbWFpbDoge1xuICAgICAgICAgIHJlcXVpcmVkOiB0cnVlLFxuICAgICAgICAgIG11dGFibGU6IHRydWUgLy8g5b6M44Gr5YCk44KS5aSJ5pu044GZ44KL44GT44Go44KS6Kix5Y+v44GZ44KLXG4gICAgICAgIH0sXG4gICAgICAgIGZ1bGxuYW1lOiB7XG4gICAgICAgICAgcmVxdWlyZWQ6IHRydWUsXG4gICAgICAgICAgbXV0YWJsZTogdHJ1ZVxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIC8vIENvZ25pdG/jgYzjg6bjg7zjgrbjg7zjga7jgrXjgqTjg7PjgqLjg4Pjg5fmmYLjgavoh6rli5XnmoTjgavnorroqo3jgZnjgovjgZ/jgoHjgavoqr/jgbnjgovlsZ7mgKdcbiAgICAgIGF1dG9WZXJpZnk6IHtcbiAgICAgICAgZW1haWw6IHRydWVcbiAgICAgIH0sXG4gICAgICAvLyDjg6bjg7zjgrbjg7zjgYzjg6bjg7zjgrbjg7zjg5fjg7zjg6vjgavnmbvpjLLjgb7jgZ/jga/jgrXjgqTjg7PjgqTjg7PjgZnjgovmlrnms5VcbiAgICAgIHNpZ25JbkFsaWFzZXM6IHtcbiAgICAgICAgZW1haWw6IHRydWUsXG4gICAgICAgIHVzZXJuYW1lOiB0cnVlXG4gICAgICB9LFxuICAgICAgLy8g44K144Kk44Oz44Kk44Oz44Ko44Kk44Oq44Ki44K544KS5aSn5paH5a2X44Go5bCP5paH5a2X44KS5Yy65Yil44GX44Gm6KmV5L6h44GZ44KL44GL44Gp44GG44GLXG4gICAgICBzaWduSW5DYXNlU2Vuc2l0aXZlOiB0cnVlLFxuICAgICAgLy8g44Om44O844K244O844Gv6Ieq5YiG44Gu44Ki44Kr44Km44Oz44OI44KS44Gp44Gu44KI44GG44Gr5Zue5b6p44Gn44GN44KL44GLXG4gICAgICBhY2NvdW50UmVjb3Zlcnk6IGNvZ25pdG8uQWNjb3VudFJlY292ZXJ5LkVNQUlMX09OTFksXG4gICAgICAvLyBlbWFpbOOBruioreWumlxuICAgICAgLy8gZW1haWxTZXR0aW5nczoge1xuICAgICAgLy8gICBmcm9tOiAnJyxcbiAgICAgIC8vICAgcmVwbHlUbzogJydcbiAgICAgIC8vIH0sXG4gICAgICAvLyDoqo3oqLzjg6Hjg7zjg6voqK3lrppcbiAgICAgIHVzZXJWZXJpZmljYXRpb246IHtcbiAgICAgICAgZW1haWxTdWJqZWN0OiAnWW91ciB2ZXJpZmljYXRpb24gY29kZScsXG4gICAgICAgIGVtYWlsQm9keTogJ1lvdXIgdmVyaWZpY2F0aW9uIGNvZGUgaXMgeyMjIyN9JyxcbiAgICAgICAgZW1haWxTdHlsZTogY29nbml0by5WZXJpZmljYXRpb25FbWFpbFN0eWxlLkNPREUsXG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBuZXcgY29nbml0by5Vc2VyUG9vbENsaWVudCh0aGlzLCAneW91ci11c2VyLXBvb2wtY2xpZW50LWlkJywge1xuICAgICAgdXNlclBvb2xDbGllbnROYW1lOiAneW91ckFwcENsaWVudE5hbWUnLFxuICAgICAgdXNlclBvb2w6IHVzZXJQb29sLFxuICAgICAgLy8g44Om44O844K244O844Gr44KI44KL6KqN6Ki844KS6Kix5Y+v44GZ44KLXG4gICAgICBhdXRoRmxvd3M6IHtcbiAgICAgICAgdXNlclBhc3N3b3JkOiB0cnVlXG4gICAgICB9LFxuICAgICAgLy8g44Kv44Op44Kk44Ki44Oz44OI44K344O844Kv44Os44OD44OI44KS55Sf5oiQ44GZ44KLXG4gICAgICBnZW5lcmF0ZVNlY3JldDogdHJ1ZSxcbiAgICAgIC8vIOOCr+ODqeOCpOOCouODs+ODiOOBjOOCouODl+ODquOBqOWvvuipseOBmeOCi+OBn+OCgeOBrk9BdXRo6Kit5a6aXG4gICAgICBvQXV0aDoge1xuICAgICAgICBmbG93czoge1xuICAgICAgICAgIGF1dGhvcml6YXRpb25Db2RlR3JhbnQ6IHRydWUsXG4gICAgICAgIH0sXG4gICAgICAgIHNjb3BlczogW2NvZ25pdG8uT0F1dGhTY29wZS5FTUFJTF0sXG4gICAgICB9LFxuICAgICAgLy8g44Om44O844K244O844GM44Om44O844K244O844OX44O844Or44Gr5a2Y5Zyo44GX44Gq44GE5aC05ZCI77yIZmFsc2XvvInjgIFDb2duaXRv44GMVXNlck5vdEZvdW5kRXhjZXB0aW9u5L6L5aSW44KS6L+U44GZ44GL44CB44G+44Gf44Gv44Om44O844K244O844Gu5LiN5Zyo44KS5piO44KJ44GL44Gr44GX44Gq44GE5Yil44Gu44K/44Kk44OX44Gu44Ko44Op44O844KS6L+U44GZ44GLXG4gICAgICBwcmV2ZW50VXNlckV4aXN0ZW5jZUVycm9yczogdHJ1ZSxcbiAgICB9KTtcblxuICAgIC8vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiAqL1xuICAgIC8vIEFQSSBHYXRld2F577yI44Oq44K944O844K5LCDjg6Hjgr3jg4Pjg4nvvInjga7kvZzmiJBcbiAgICAvLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiogKi9cbiAgICBjb25zdCBhcGkgPSBuZXcgUmVzdEFwaSh0aGlzLCBcInNjaGVkdWxlLW1hbmFnZXItYXBpXCIsIHtcbiAgICAgIHJlc3RBcGlOYW1lOiBcInNjaGVkdWxlLW1hbmFnZXItYXBpXCIsXG4gICAgICBjbG91ZFdhdGNoUm9sZTogdHJ1ZSxcblxuICAgIH0pO1xuICAgIGNvbnN0IHNjYW5NZWV0aW5nID0gYXBpLnJvb3QuYWRkUmVzb3VyY2UoXCJzY2FuLW1lZXRpbmdcIik7XG5cbiAgICBjb25zdCBzY2FuTWVldGluZ0xhbWJkYUludGVncmF0aW9uID0gbmV3IExhbWJkYUludGVncmF0aW9uKHNjYW5NZWV0aW5nRnVuY3Rpb24pO1xuICAgIHNjYW5NZWV0aW5nLmFkZE1ldGhvZChcIlBPU1RcIiwgc2Nhbk1lZXRpbmdMYW1iZGFJbnRlZ3JhdGlvbik7XG4gICAgYWRkQ29yc09wdGlvbnMoc2Nhbk1lZXRpbmcpO1xuXG4gICAgY29uc3QgcmVnaXN0TWVldGluZyA9IGFwaS5yb290LmFkZFJlc291cmNlKFwicmVnaXN0LW1lZXRpbmdcIik7XG5cbiAgICBjb25zdCByZWdpc3RNZWV0aW5nTGFtYmRhSW50ZWdyYXRpb24gPSBuZXcgTGFtYmRhSW50ZWdyYXRpb24ocmVnaXN0TWVldGluZ0Z1bmN0aW9uKTtcbiAgICByZWdpc3RNZWV0aW5nLmFkZE1ldGhvZChcIlBPU1RcIiwgcmVnaXN0TWVldGluZ0xhbWJkYUludGVncmF0aW9uKTtcbiAgICBhZGRDb3JzT3B0aW9ucyhyZWdpc3RNZWV0aW5nKTtcbiAgfVxufVxuXG4vLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiogKi9cbi8vIEFQSSBHYXRld2F544Gu44Oh44K944OD44OJ44GrT1BUSU9O44KS6L+95YqgXG4vLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiogKi9cbmV4cG9ydCBmdW5jdGlvbiBhZGRDb3JzT3B0aW9ucyhhcGlSZXNvdXJjZTogSVJlc291cmNlKSB7XG4gIGFwaVJlc291cmNlLmFkZE1ldGhvZChcbiAgICBcIk9QVElPTlNcIixcbiAgICBuZXcgTW9ja0ludGVncmF0aW9uKHtcbiAgICAgIGludGVncmF0aW9uUmVzcG9uc2VzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBzdGF0dXNDb2RlOiBcIjIwMFwiLFxuICAgICAgICAgIHJlc3BvbnNlUGFyYW1ldGVyczoge1xuICAgICAgICAgICAgXCJtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LUhlYWRlcnNcIjogXCInQ29udGVudC1UeXBlLFgtQW16LURhdGUsQXV0aG9yaXphdGlvbixYLUFwaS1LZXksWC1BbXotU2VjdXJpdHktVG9rZW4sWC1BbXotVXNlci1BZ2VudCdcIixcbiAgICAgICAgICAgIFwibWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW5cIjogXCInKidcIixcbiAgICAgICAgICAgIFwibWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1DcmVkZW50aWFsc1wiOiBcIidmYWxzZSdcIixcbiAgICAgICAgICAgIFwibWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1NZXRob2RzXCI6IFwiJ09QVElPTlMsR0VULFBVVCxQT1NULERFTEVURSdcIixcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICAgIHBhc3N0aHJvdWdoQmVoYXZpb3I6IFBhc3N0aHJvdWdoQmVoYXZpb3IuTkVWRVIsXG4gICAgICByZXF1ZXN0VGVtcGxhdGVzOiB7XG4gICAgICAgIFwiYXBwbGljYXRpb24vanNvblwiOiAne1wic3RhdHVzQ29kZVwiOiAyMDB9JyxcbiAgICAgIH0sXG4gICAgfSksXG4gICAge1xuICAgICAgbWV0aG9kUmVzcG9uc2VzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBzdGF0dXNDb2RlOiBcIjIwMFwiLFxuICAgICAgICAgIHJlc3BvbnNlUGFyYW1ldGVyczoge1xuICAgICAgICAgICAgXCJtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LUhlYWRlcnNcIjogdHJ1ZSxcbiAgICAgICAgICAgIFwibWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1NZXRob2RzXCI6IHRydWUsXG4gICAgICAgICAgICBcIm1ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctQ3JlZGVudGlhbHNcIjogdHJ1ZSxcbiAgICAgICAgICAgIFwibWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW5cIjogdHJ1ZSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9XG4gICk7XG59XG4iXX0=