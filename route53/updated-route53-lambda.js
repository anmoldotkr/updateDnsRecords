let aws = require('aws-sdk');
let _ = require('lodash');
let sharedAssumableRole = "arn:aws:iam::<AWS::ACCOUNT>:role/${environment}-${product}-route53-lambda-role"; // make sure you update the role for updating your route53 this line we use for if route53 in separate account
let web = require('./web_requests.js');
let params;

exports.handler = async (event, context) => {
    let sendresponse = async (event, context, status) => {
        let responseBody = {
            "Status": status,
            "Reason": `See the details in CloudWatch Log Stream at ${context.logStreamName}`,
            "PhysicalResourceId": event.LogicalResourceId,
            "StackId": event.StackId,
            "RequestId": event.RequestId,
            "LogicalResourceId": event.LogicalResourceId
        };
        console.log("\n\nRESPONSE BODY:\n\n" + JSON.stringify(responseBody));
        let url = event.ResponseURL;
        let headers = {
            "Content-Type": "",
            "Content-Length": responseBody.length
        };
        return await web.put(url, headers, responseBody);
    };
    try {
        console.log("\n\nREQUEST RECEIVED:\n\n" + JSON.stringify(event));
        aws.config.credentials = new aws.TemporaryCredentials({
            'RoleArn': sharedAssumableRole
        });
        let route53 = new aws.Route53();
        console.log("\n\nAssumed Shared Account Role ==> "+sharedAssumableRole);
        const domainName = event.ResourceProperties.recordName.split('.').slice(-2).join('.');
        console.log(`Domain Name extracted: ${domainName}`);

        // Fetch all hosted zones and find the matching one
        const hostedZones = await route53.listHostedZones().promise();
        const matchingZone = hostedZones.HostedZones.find(zone =>
            zone.Name === `${domainName}.` || zone.Name === `${domainName}`
        );

        if (!matchingZone) {
            throw new Error(`No matching hosted zone found for domain: ${domainName}`);
        }
        console.log(`Matching Hosted Zone ID: ${matchingZone.Id}`);
        const hostedZoneId = matchingZone.Id.replace('/hostedzone/', '');

        switch (event.RequestType) {
            case 'Create':
                params = {
                    ChangeBatch: {
                        Changes: [{
                            Action: "UPSERT",
                            ResourceRecordSet: {
                                Name: event.ResourceProperties.recordName,
                                ResourceRecords: [{
                                    Value: event.ResourceProperties.recordValue
                                }],
                                TTL: 300,
                                Type: "CNAME"
                            }
                        }],
                        Comment: "Created Via Lambda"
                    },
                    HostedZoneId: hostedZoneId
                };
                response = await route53.changeResourceRecordSets(params).promise();
                console.log(`\n\nRoute53 Record Created and here is the response:\n\n ${JSON.stringify(response)}`);
                break;
            case 'Delete':
                params = {
                    ChangeBatch: {
                        Changes: [{
                            Action: "DELETE",
                            ResourceRecordSet: {
                                Name: event.ResourceProperties.recordName,
                                ResourceRecords: [{
                                    Value: event.ResourceProperties.recordValue
                                }],
                                TTL: 300,
                                Type: "CNAME"
                            }
                        }],
                        Comment: "Deleted Via Lambda"
                    },
                    HostedZoneId: hostedZoneId
                };
                response = await route53.changeResourceRecordSets(params).promise();
                console.log(`\n\nRoute53 Record Deleted and here is the response:\n\n ${JSON.stringify(response)}`);
                break;
            default:
                throw new Error(`\n\nUnrecognized event :\n\n ${event.RequestType}`);
        };
        let status = "SUCCESS";
        response = await sendresponse(event, context, status);
        console.log(`Lambda Executed Successfully and here is the response: ${response}`);
    } catch (error) {
        console.log(error)
        let status = "FAILED";
        let response = await sendresponse(event, context, status);
        console.log(`\n\nLambda Execution Failed and here is the response:\n\n ${response}`);
    }
}
