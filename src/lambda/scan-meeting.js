'use strict';

const aws = require('aws-sdk');
const docClient = new aws.DynamoDB.DocumentClient({ region: 'ap-northeast-1' });
const table = process.env['TABLE_NAME'];
const corsURL = process.env['CORS_URL']

// レスポンス用ヘッダーとボディを定義
const createResponse = (status, data) => ({
    statusCode: status,
    headers: {
        'content-security-policy': 'default-src "self"; img-src "self" data :; style-src "self"; script-src "self"; frame-ancestors "self"',
        'strict-transport-security': 'max-age=63072000; includeSubdomains; preload',
        'X-Content-Type-Options': 'nosniff',
        'X-XSS-Protection': '1; mode=block',
        'Access-Control-Allow-Origin': corsURL,
        'Access-Control-Allow-Credentials': 'true',
        'Cache-Control': 'no-store',
        'Pragma': 'no-cache',
    },
    body: JSON.stringify(data),
    isBase64Encoded: false,
});

exports.handler = async function(event, context) {
    const body = JSON.parse(event.body);

    const hostId = body.hostId;


    if (!hostId) {
        return createResponse(400, 'Bad Request');
    }


    const params = {
        TableName: table,
    };

    let result;

    try {
        result = await scanHostMeeting(params);
        console.log(result)

        let hostMeetings = []
        for (let i = 0; i < result.Items.length; i++) {
            if (result.Items[i].host_id === hostId) {
                hostMeetings.push(result.Items[i])
            }
        }

        return createResponse(200, hostMeetings);
    } catch (e) {
        console.log(e);
        return createResponse(500, 'InternalServerError');
    }
};


const scanHostMeeting = (params) => {
    return new Promise((resoleve, reject) => {
        docClient.scan(params, function(err, data) {
            if (err) {
                reject(err);
            } else {
                resoleve(data);
            }
        });
    });
}