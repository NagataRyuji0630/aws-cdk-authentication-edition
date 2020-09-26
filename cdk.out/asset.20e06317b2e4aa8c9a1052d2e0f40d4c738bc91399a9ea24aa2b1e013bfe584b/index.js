"use strict";
/* eslint-disable no-console */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
// eslint-disable-next-line import/no-extraneous-dependencies
const AWS = require("aws-sdk");
/**
 * Creates a log group and doesn't throw if it exists.
 *
 * @param logGroupName the name of the log group to create.
 * @param region to create the log group in
 * @param options CloudWatch API SDK options.
 */
async function createLogGroupSafe(logGroupName, region, options) {
    try { // Try to create the log group
        const cloudwatchlogs = new AWS.CloudWatchLogs({ apiVersion: '2014-03-28', region, ...options });
        await cloudwatchlogs.createLogGroup({ logGroupName }).promise();
    }
    catch (e) {
        if (e.code !== 'ResourceAlreadyExistsException') {
            throw e;
        }
    }
}
/**
 * Puts or deletes a retention policy on a log group.
 *
 * @param logGroupName the name of the log group to create
 * @param region the region of the log group
 * @param options CloudWatch API SDK options.
 * @param retentionInDays the number of days to retain the log events in the specified log group.
 */
async function setRetentionPolicy(logGroupName, region, options, retentionInDays) {
    const cloudwatchlogs = new AWS.CloudWatchLogs({ apiVersion: '2014-03-28', region, ...options });
    if (!retentionInDays) {
        await cloudwatchlogs.deleteRetentionPolicy({ logGroupName }).promise();
    }
    else {
        await cloudwatchlogs.putRetentionPolicy({ logGroupName, retentionInDays }).promise();
    }
}
async function handler(event, context) {
    try {
        console.log(JSON.stringify(event));
        // The target log group
        const logGroupName = event.ResourceProperties.LogGroupName;
        // The region of the target log group
        const logGroupRegion = event.ResourceProperties.LogGroupRegion;
        // Parse to AWS SDK retry options
        const retryOptions = parseRetryOptions(event.ResourceProperties.SdkRetry);
        if (event.RequestType === 'Create' || event.RequestType === 'Update') {
            // Act on the target log group
            await createLogGroupSafe(logGroupName, logGroupRegion, retryOptions);
            await setRetentionPolicy(logGroupName, logGroupRegion, retryOptions, parseInt(event.ResourceProperties.RetentionInDays, 10));
            if (event.RequestType === 'Create') {
                // Set a retention policy of 1 day on the logs of this function. The log
                // group for this function should already exist at this stage because we
                // already logged the event but due to the async nature of Lambda logging
                // there could be a race condition. So we also try to create the log group
                // of this function first. If multiple LogRetention constructs are present
                // in the stack, they will try to act on this function's log group at the
                // same time. This can sometime result in an OperationAbortedException. To
                // avoid this and because this operation is not critical we catch all errors.
                try {
                    const region = process.env.AWS_REGION;
                    await createLogGroupSafe(`/aws/lambda/${context.functionName}`, region, retryOptions);
                    await setRetentionPolicy(`/aws/lambda/${context.functionName}`, region, retryOptions, 1);
                }
                catch (e) {
                    console.log(e);
                }
            }
        }
        await respond('SUCCESS', 'OK', logGroupName);
    }
    catch (e) {
        console.log(e);
        await respond('FAILED', e.message, event.ResourceProperties.LogGroupName);
    }
    function respond(responseStatus, reason, physicalResourceId) {
        const responseBody = JSON.stringify({
            Status: responseStatus,
            Reason: reason,
            PhysicalResourceId: physicalResourceId,
            StackId: event.StackId,
            RequestId: event.RequestId,
            LogicalResourceId: event.LogicalResourceId,
            Data: {
                // Add log group name as part of the response so that it's available via Fn::GetAtt
                LogGroupName: event.ResourceProperties.LogGroupName,
            },
        });
        console.log('Responding', responseBody);
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const parsedUrl = require('url').parse(event.ResponseURL);
        const requestOptions = {
            hostname: parsedUrl.hostname,
            path: parsedUrl.path,
            method: 'PUT',
            headers: { 'content-type': '', 'content-length': responseBody.length },
        };
        return new Promise((resolve, reject) => {
            try {
                // eslint-disable-next-line @typescript-eslint/no-require-imports
                const request = require('https').request(requestOptions, resolve);
                request.on('error', reject);
                request.write(responseBody);
                request.end();
            }
            catch (e) {
                reject(e);
            }
        });
    }
    function parseRetryOptions(rawOptions) {
        const retryOptions = {};
        if (rawOptions) {
            if (rawOptions.maxRetries) {
                retryOptions.maxRetries = parseInt(rawOptions.maxRetries, 10);
            }
            if (rawOptions.base) {
                retryOptions.retryOptions = {
                    base: parseInt(rawOptions.base, 10),
                };
            }
        }
        return retryOptions;
    }
}
exports.handler = handler;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUEsK0JBQStCOzs7QUFFL0IsNkRBQTZEO0FBQzdELCtCQUErQjtBQVMvQjs7Ozs7O0dBTUc7QUFDSCxLQUFLLFVBQVUsa0JBQWtCLENBQUMsWUFBb0IsRUFBRSxNQUFlLEVBQUUsT0FBeUI7SUFDaEcsSUFBSSxFQUFFLDhCQUE4QjtRQUNsQyxNQUFNLGNBQWMsR0FBRyxJQUFJLEdBQUcsQ0FBQyxjQUFjLENBQUMsRUFBRSxVQUFVLEVBQUUsWUFBWSxFQUFFLE1BQU0sRUFBRSxHQUFHLE9BQU8sRUFBRSxDQUFDLENBQUM7UUFDaEcsTUFBTSxjQUFjLENBQUMsY0FBYyxDQUFDLEVBQUUsWUFBWSxFQUFFLENBQUMsQ0FBQyxPQUFPLEVBQUUsQ0FBQztLQUNqRTtJQUFDLE9BQU8sQ0FBQyxFQUFFO1FBQ1YsSUFBSSxDQUFDLENBQUMsSUFBSSxLQUFLLGdDQUFnQyxFQUFFO1lBQy9DLE1BQU0sQ0FBQyxDQUFDO1NBQ1Q7S0FDRjtBQUNILENBQUM7QUFFRDs7Ozs7OztHQU9HO0FBQ0gsS0FBSyxVQUFVLGtCQUFrQixDQUFDLFlBQW9CLEVBQUUsTUFBZSxFQUFFLE9BQXlCLEVBQUUsZUFBd0I7SUFDMUgsTUFBTSxjQUFjLEdBQUcsSUFBSSxHQUFHLENBQUMsY0FBYyxDQUFDLEVBQUUsVUFBVSxFQUFFLFlBQVksRUFBRSxNQUFNLEVBQUUsR0FBRyxPQUFPLEVBQUUsQ0FBQyxDQUFDO0lBQ2hHLElBQUksQ0FBQyxlQUFlLEVBQUU7UUFDcEIsTUFBTSxjQUFjLENBQUMscUJBQXFCLENBQUMsRUFBRSxZQUFZLEVBQUUsQ0FBQyxDQUFDLE9BQU8sRUFBRSxDQUFDO0tBQ3hFO1NBQU07UUFDTCxNQUFNLGNBQWMsQ0FBQyxrQkFBa0IsQ0FBQyxFQUFFLFlBQVksRUFBRSxlQUFlLEVBQUUsQ0FBQyxDQUFDLE9BQU8sRUFBRSxDQUFDO0tBQ3RGO0FB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QztBQWhHRCwwQkFnR0MiLCJzb3VyY2VzQ29udGVudCI6WyIvKiBlc2xpbnQtZGlzYWJsZSBuby1jb25zb2xlICovXG5cbi8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBpbXBvcnQvbm8tZXh0cmFuZW91cy1kZXBlbmRlbmNpZXNcbmltcG9ydCAqIGFzIEFXUyBmcm9tICdhd3Mtc2RrJztcbi8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBpbXBvcnQvbm8tZXh0cmFuZW91cy1kZXBlbmRlbmNpZXNcbmltcG9ydCB7IFJldHJ5RGVsYXlPcHRpb25zIH0gZnJvbSAnYXdzLXNkay9saWIvY29uZmlnJztcblxuaW50ZXJmYWNlIFNka1JldHJ5T3B0aW9ucyB7XG4gIG1heFJldHJpZXM/OiBudW1iZXI7XG4gIHJldHJ5T3B0aW9ucz86IFJldHJ5RGVsYXlPcHRpb25zO1xufVxuXG4vKipcbiAqIENyZWF0ZXMgYSBsb2cgZ3JvdXAgYW5kIGRvZXNuJ3QgdGhyb3cgaWYgaXQgZXhpc3RzLlxuICpcbiAqIEBwYXJhbSBsb2dHcm91cE5hbWUgdGhlIG5hbWUgb2YgdGhlIGxvZyBncm91cCB0byBjcmVhdGUuXG4gKiBAcGFyYW0gcmVnaW9uIHRvIGNyZWF0ZSB0aGUgbG9nIGdyb3VwIGluXG4gKiBAcGFyYW0gb3B0aW9ucyBDbG91ZFdhdGNoIEFQSSBTREsgb3B0aW9ucy5cbiAqL1xuYXN5bmMgZnVuY3Rpb24gY3JlYXRlTG9nR3JvdXBTYWZlKGxvZ0dyb3VwTmFtZTogc3RyaW5nLCByZWdpb24/OiBzdHJpbmcsIG9wdGlvbnM/OiBTZGtSZXRyeU9wdGlvbnMpIHtcbiAgdHJ5IHsgLy8gVHJ5IHRvIGNyZWF0ZSB0aGUgbG9nIGdyb3VwXG4gICAgY29uc3QgY2xvdWR3YXRjaGxvZ3MgPSBuZXcgQVdTLkNsb3VkV2F0Y2hMb2dzKHsgYXBpVmVyc2lvbjogJzIwMTQtMDMtMjgnLCByZWdpb24sIC4uLm9wdGlvbnMgfSk7XG4gICAgYXdhaXQgY2xvdWR3YXRjaGxvZ3MuY3JlYXRlTG9nR3JvdXAoeyBsb2dHcm91cE5hbWUgfSkucHJvbWlzZSgpO1xuICB9IGNhdGNoIChlKSB7XG4gICAgaWYgKGUuY29kZSAhPT0gJ1Jlc291cmNlQWxyZWFkeUV4aXN0c0V4Y2VwdGlvbicpIHtcbiAgICAgIHRocm93IGU7XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogUHV0cyBvciBkZWxldGVzIGEgcmV0ZW50aW9uIHBvbGljeSBvbiBhIGxvZyBncm91cC5cbiAqXG4gKiBAcGFyYW0gbG9nR3JvdXBOYW1lIHRoZSBuYW1lIG9mIHRoZSBsb2cgZ3JvdXAgdG8gY3JlYXRlXG4gKiBAcGFyYW0gcmVnaW9uIHRoZSByZWdpb24gb2YgdGhlIGxvZyBncm91cFxuICogQHBhcmFtIG9wdGlvbnMgQ2xvdWRXYXRjaCBBUEkgU0RLIG9wdGlvbnMuXG4gKiBAcGFyYW0gcmV0ZW50aW9uSW5EYXlzIHRoZSBudW1iZXIgb2YgZGF5cyB0byByZXRhaW4gdGhlIGxvZyBldmVudHMgaW4gdGhlIHNwZWNpZmllZCBsb2cgZ3JvdXAuXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIHNldFJldGVudGlvblBvbGljeShsb2dHcm91cE5hbWU6IHN0cmluZywgcmVnaW9uPzogc3RyaW5nLCBvcHRpb25zPzogU2RrUmV0cnlPcHRpb25zLCByZXRlbnRpb25JbkRheXM/OiBudW1iZXIpIHtcbiAgY29uc3QgY2xvdWR3YXRjaGxvZ3MgPSBuZXcgQVdTLkNsb3VkV2F0Y2hMb2dzKHsgYXBpVmVyc2lvbjogJzIwMTQtMDMtMjgnLCByZWdpb24sIC4uLm9wdGlvbnMgfSk7XG4gIGlmICghcmV0ZW50aW9uSW5EYXlzKSB7XG4gICAgYXdhaXQgY2xvdWR3YXRjaGxvZ3MuZGVsZXRlUmV0ZW50aW9uUG9saWN5KHsgbG9nR3JvdXBOYW1lIH0pLnByb21pc2UoKTtcbiAgfSBlbHNlIHtcbiAgICBhd2FpdCBjbG91ZHdhdGNobG9ncy5wdXRSZXRlbnRpb25Qb2xpY3koeyBsb2dHcm91cE5hbWUsIHJldGVudGlvbkluRGF5cyB9KS5wcm9taXNlKCk7XG4gIH1cbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGhhbmRsZXIoZXZlbnQ6IEFXU0xhbWJkYS5DbG91ZEZvcm1hdGlvbkN1c3RvbVJlc291cmNlRXZlbnQsIGNvbnRleHQ6IEFXU0xhbWJkYS5Db250ZXh0KSB7XG4gIHRyeSB7XG4gICAgY29uc29sZS5sb2coSlNPTi5zdHJpbmdpZnkoZXZlbnQpKTtcblxuICAgIC8vIFRoZSB0YXJnZXQgbG9nIGdyb3VwXG4gICAgY29uc3QgbG9nR3JvdXBOYW1lID0gZXZlbnQuUmVzb3VyY2VQcm9wZXJ0aWVzLkxvZ0dyb3VwTmFtZTtcblxuICAgIC8vIFRoZSByZWdpb24gb2YgdGhlIHRhcmdldCBsb2cgZ3JvdXBcbiAgICBjb25zdCBsb2dHcm91cFJlZ2lvbiA9IGV2ZW50LlJlc291cmNlUHJvcGVydGllcy5Mb2dHcm91cFJlZ2lvbjtcblxuICAgIC8vIFBhcnNlIHRvIEFXUyBTREsgcmV0cnkgb3B0aW9uc1xuICAgIGNvbnN0IHJldHJ5T3B0aW9ucyA9IHBhcnNlUmV0cnlPcHRpb25zKGV2ZW50LlJlc291cmNlUHJvcGVydGllcy5TZGtSZXRyeSk7XG5cbiAgICBpZiAoZXZlbnQuUmVxdWVzdFR5cGUgPT09ICdDcmVhdGUnIHx8IGV2ZW50LlJlcXVlc3RUeXBlID09PSAnVXBkYXRlJykge1xuICAgICAgLy8gQWN0IG9uIHRoZSB0YXJnZXQgbG9nIGdyb3VwXG4gICAgICBhd2FpdCBjcmVhdGVMb2dHcm91cFNhZmUobG9nR3JvdXBOYW1lLCBsb2dHcm91cFJlZ2lvbiwgcmV0cnlPcHRpb25zKTtcbiAgICAgIGF3YWl0IHNldFJldGVudGlvblBvbGljeShsb2dHcm91cE5hbWUsIGxvZ0dyb3VwUmVnaW9uLCByZXRyeU9wdGlvbnMsIHBhcnNlSW50KGV2ZW50LlJlc291cmNlUHJvcGVydGllcy5SZXRlbnRpb25JbkRheXMsIDEwKSk7XG5cbiAgICAgIGlmIChldmVudC5SZXF1ZXN0VHlwZSA9PT0gJ0NyZWF0ZScpIHtcbiAgICAgICAgLy8gU2V0IGEgcmV0ZW50aW9uIHBvbGljeSBvZiAxIGRheSBvbiB0aGUgbG9ncyBvZiB0aGlzIGZ1bmN0aW9uLiBUaGUgbG9nXG4gICAgICAgIC8vIGdyb3VwIGZvciB0aGlzIGZ1bmN0aW9uIHNob3VsZCBhbHJlYWR5IGV4aXN0IGF0IHRoaXMgc3RhZ2UgYmVjYXVzZSB3ZVxuICAgICAgICAvLyBhbHJlYWR5IGxvZ2dlZCB0aGUgZXZlbnQgYnV0IGR1ZSB0byB0aGUgYXN5bmMgbmF0dXJlIG9mIExhbWJkYSBsb2dnaW5nXG4gICAgICAgIC8vIHRoZXJlIGNvdWxkIGJlIGEgcmFjZSBjb25kaXRpb24uIFNvIHdlIGFsc28gdHJ5IHRvIGNyZWF0ZSB0aGUgbG9nIGdyb3VwXG4gICAgICAgIC8vIG9mIHRoaXMgZnVuY3Rpb24gZmlyc3QuIElmIG11bHRpcGxlIExvZ1JldGVudGlvbiBjb25zdHJ1Y3RzIGFyZSBwcmVzZW50XG4gICAgICAgIC8vIGluIHRoZSBzdGFjaywgdGhleSB3aWxsIHRyeSB0byBhY3Qgb24gdGhpcyBmdW5jdGlvbidzIGxvZyBncm91cCBhdCB0aGVcbiAgICAgICAgLy8gc2FtZSB0aW1lLiBUaGlzIGNhbiBzb21ldGltZSByZXN1bHQgaW4gYW4gT3BlcmF0aW9uQWJvcnRlZEV4Y2VwdGlvbi4gVG9cbiAgICAgICAgLy8gYXZvaWQgdGhpcyBhbmQgYmVjYXVzZSB0aGlzIG9wZXJhdGlvbiBpcyBub3QgY3JpdGljYWwgd2UgY2F0Y2ggYWxsIGVycm9ycy5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBjb25zdCByZWdpb24gPSBwcm9jZXNzLmVudi5BV1NfUkVHSU9OO1xuICAgICAgICAgIGF3YWl0IGNyZWF0ZUxvZ0dyb3VwU2FmZShgL2F3cy9sYW1iZGEvJHtjb250ZXh0LmZ1bmN0aW9uTmFtZX1gLCByZWdpb24sIHJldHJ5T3B0aW9ucyk7XG4gICAgICAgICAgYXdhaXQgc2V0UmV0ZW50aW9uUG9saWN5KGAvYXdzL2xhbWJkYS8ke2NvbnRleHQuZnVuY3Rpb25OYW1lfWAsIHJlZ2lvbiwgcmV0cnlPcHRpb25zLCAxKTtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgIGNvbnNvbGUubG9nKGUpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgYXdhaXQgcmVzcG9uZCgnU1VDQ0VTUycsICdPSycsIGxvZ0dyb3VwTmFtZSk7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBjb25zb2xlLmxvZyhlKTtcblxuICAgIGF3YWl0IHJlc3BvbmQoJ0ZBSUxFRCcsIGUubWVzc2FnZSwgZXZlbnQuUmVzb3VyY2VQcm9wZXJ0aWVzLkxvZ0dyb3VwTmFtZSk7XG4gIH1cblxuICBmdW5jdGlvbiByZXNwb25kKHJlc3BvbnNlU3RhdHVzOiBzdHJpbmcsIHJlYXNvbjogc3RyaW5nLCBwaHlzaWNhbFJlc291cmNlSWQ6IHN0cmluZykge1xuICAgIGNvbnN0IHJlc3BvbnNlQm9keSA9IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgIFN0YXR1czogcmVzcG9uc2VTdGF0dXMsXG4gICAgICBSZWFzb246IHJlYXNvbixcbiAgICAgIFBoeXNpY2FsUmVzb3VyY2VJZDogcGh5c2ljYWxSZXNvdXJjZUlkLFxuICAgICAgU3RhY2tJZDogZXZlbnQuU3RhY2tJZCxcbiAgICAgIFJlcXVlc3RJZDogZXZlbnQuUmVxdWVzdElkLFxuICAgICAgTG9naWNhbFJlc291cmNlSWQ6IGV2ZW50LkxvZ2ljYWxSZXNvdXJjZUlkLFxuICAgICAgRGF0YToge1xuICAgICAgICAvLyBBZGQgbG9nIGdyb3VwIG5hbWUgYXMgcGFydCBvZiB0aGUgcmVzcG9uc2Ugc28gdGhhdCBpdCdzIGF2YWlsYWJsZSB2aWEgRm46OkdldEF0dFxuICAgICAgICBMb2dHcm91cE5hbWU6IGV2ZW50LlJlc291cmNlUHJvcGVydGllcy5Mb2dHcm91cE5hbWUsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgY29uc29sZS5sb2coJ1Jlc3BvbmRpbmcnLCByZXNwb25zZUJvZHkpO1xuXG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1yZXF1aXJlLWltcG9ydHNcbiAgICBjb25zdCBwYXJzZWRVcmwgPSByZXF1aXJlKCd1cmwnKS5wYXJzZShldmVudC5SZXNwb25zZVVSTCk7XG4gICAgY29uc3QgcmVxdWVzdE9wdGlvbnMgPSB7XG4gICAgICBob3N0bmFtZTogcGFyc2VkVXJsLmhvc3RuYW1lLFxuICAgICAgcGF0aDogcGFyc2VkVXJsLnBhdGgsXG4gICAgICBtZXRob2Q6ICdQVVQnLFxuICAgICAgaGVhZGVyczogeyAnY29udGVudC10eXBlJzogJycsICdjb250ZW50LWxlbmd0aCc6IHJlc3BvbnNlQm9keS5sZW5ndGggfSxcbiAgICB9O1xuXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIHRyeSB7XG4gICAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tcmVxdWlyZS1pbXBvcnRzXG4gICAgICAgIGNvbnN0IHJlcXVlc3QgPSByZXF1aXJlKCdodHRwcycpLnJlcXVlc3QocmVxdWVzdE9wdGlvbnMsIHJlc29sdmUpO1xuICAgICAgICByZXF1ZXN0Lm9uKCdlcnJvcicsIHJlamVjdCk7XG4gICAgICAgIHJlcXVlc3Qud3JpdGUocmVzcG9uc2VCb2R5KTtcbiAgICAgICAgcmVxdWVzdC5lbmQoKTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgcmVqZWN0KGUpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgZnVuY3Rpb24gcGFyc2VSZXRyeU9wdGlvbnMocmF3T3B0aW9uczogYW55KTogU2RrUmV0cnlPcHRpb25zIHtcbiAgICBjb25zdCByZXRyeU9wdGlvbnM6IFNka1JldHJ5T3B0aW9ucyA9IHt9O1xuICAgIGlmIChyYXdPcHRpb25zKSB7XG4gICAgICBpZiAocmF3T3B0aW9ucy5tYXhSZXRyaWVzKSB7XG4gICAgICAgIHJldHJ5T3B0aW9ucy5tYXhSZXRyaWVzID0gcGFyc2VJbnQocmF3T3B0aW9ucy5tYXhSZXRyaWVzLCAxMCk7XG4gICAgICB9XG4gICAgICBpZiAocmF3T3B0aW9ucy5iYXNlKSB7XG4gICAgICAgIHJldHJ5T3B0aW9ucy5yZXRyeU9wdGlvbnMgPSB7XG4gICAgICAgICAgYmFzZTogcGFyc2VJbnQocmF3T3B0aW9ucy5iYXNlLCAxMCksXG4gICAgICAgIH07XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiByZXRyeU9wdGlvbnM7XG4gIH1cbn1cbiJdfQ==