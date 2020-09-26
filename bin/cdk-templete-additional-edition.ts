#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { CdkTempleteAdditionalEditionStack } from '../lib/cdk-templete-additional-edition-stack';

const app = new cdk.App();
new CdkTempleteAdditionalEditionStack(app, 'CdkTempleteAdditionalEditionStack');
