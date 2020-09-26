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

    const meetingId = Math.floor(Math.random() * 9000000000) + 1000000000;
    const password = body.password;
    const roomName = body.roomName;
    const hostId = body.hostId;

    if (!password || !roomName || !hostId) {
        return createResponse(400, 'Bad Request');
    }

    const item = {
        meeting_id: meetingId,
        password: password,
        room_name: roomName,
        host_id: hostId,
    };
    console.log(item);

    const params = {
        TableName: table,
        Item: item
    };
    console.log(params);

    let result;

    try {
        result = await putMeetingInfo(params);
        return createResponse(200, meetingId);
    } catch (e) {
        console.log(e);
        return createResponse(500, 'InternalServerError');
    }
};


const putMeetingInfo = (params) => {
    return new Promise((resoleve, reject) => {
        docClient.put(params, function(err, data) {
            if (err) {
                reject(err);
            } else {
                resoleve(data);
            }
        });
    });
}