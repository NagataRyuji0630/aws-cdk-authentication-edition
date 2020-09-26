import * as cdk from '@aws-cdk/core';
import { IResource } from "@aws-cdk/aws-apigateway";
export declare class CdkTempleteAdditionalEditionStack extends cdk.Stack {
    constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps);
}
export declare function addCorsOptions(apiResource: IResource): void;
