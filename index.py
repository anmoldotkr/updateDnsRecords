
import boto3
import json
import urllib3
import os
import time

TEMPLATE_FILE_PATH = "/var/task/elasticache.yaml"
SLACK_WEBHOOK_URL = os.environ.get("SLACK_WEBHOOK_URL", "")

http = urllib3.PoolManager()

def lambda_handler(event, context):
    detail = event.get("detail", {})
    request_type = detail.get("RequestType", "").lower()  # "create" or "delete"
    parameters = detail.get("parameters", {})

    # Extract necessary parameters
    environment = parameters.get("environment", "")
    product = parameters.get("product", "extv")
    service = parameters.get("service", "redis")

    stack_name = f"{environment}-{product}-{service}"
    region = parameters.get("region", "us-west-2")

    aws_account_id = boto3.client("sts").get_caller_identity()["Account"]

    cf_client = boto3.client("cloudformation", region_name=region)

    try:
        if request_type == "create":
            return create_stack(cf_client, stack_name, parameters, region, aws_account_id)
        elif request_type == "delete":
            return delete_stack(cf_client, stack_name, region, aws_account_id)
        else:
            raise ValueError("Invalid RequestType. Use 'Create' or 'Delete'.")

    except Exception as e:
        print(f"Error: {str(e)}")
        send_slack_message(f"❌ Error processing request: {str(e)}", region, aws_account_id, request_type)
        return {"statusCode": 500, "body": json.dumps({"error": str(e)})}


def create_stack(cf_client, stack_name, parameters, region, aws_account_id):
    cf_parameters = [{"ParameterKey": key, "ParameterValue": value} for key, value in parameters.items()]

    try:
        with open(TEMPLATE_FILE_PATH, "r") as template_file:
            template_body = template_file.read()

        response = cf_client.create_stack(
            StackName=stack_name,
            TemplateBody=template_body,
            Parameters=cf_parameters,
            OnFailure="ROLLBACK"
        )

        stack_id = response["StackId"]
        print(f"Stack creation initiated: {stack_id}")

        waiter = cf_client.get_waiter("stack_create_complete")
        print("Waiting for stack to be created...")
        waiter.wait(StackName=stack_name)

        stack_info = cf_client.describe_stacks(StackName=stack_name)
        outputs = stack_info["Stacks"][0].get("Outputs", [])
        redis_cluster_name = next(
            (output["OutputValue"] for output in outputs if output["OutputKey"] == "redisClusterName"), "N/A"
        )

        print(f"✅ Stack `{stack_name}` created successfully. Cluster Name: {redis_cluster_name}")
        send_slack_message(f"✅ Stack `{stack_name}` created successfully.\n *Cluster*: `{redis_cluster_name}`", region, aws_account_id, "Create")

        return {
            "statusCode": 200,
            "body": json.dumps({
                "message": "Stack creation completed",
                "stackId": stack_id,
                "region": region,
                "awsAccountId": aws_account_id,
                "redisClusterName": redis_cluster_name,
                "action": "Create"
            })
        }

    except Exception as e:
        print(f"❌ Error creating stack: {str(e)}")
        send_slack_message(f"❌ Stack `{stack_name}` creation failed. Error: {str(e)}", region, aws_account_id, "Create")
        return {"statusCode": 500, "body": json.dumps({"error": str(e)})}


def delete_stack(cf_client, stack_name, region, aws_account_id):
    try:
        stack_info = cf_client.describe_stacks(StackName=stack_name)
        outputs = stack_info["Stacks"][0].get("Outputs", [])
        redis_cluster_name = next(
            (output["OutputValue"] for output in outputs if output["OutputKey"] == "redisClusterName"), "N/A"
        )

        cf_client.delete_stack(StackName=stack_name)
        print(f"Stack deletion initiated: {stack_name}")

        waiter = cf_client.get_waiter("stack_delete_complete")
        print("Waiting for stack to be deleted...")
        waiter.wait(StackName=stack_name)

        print(f"✅ Stack `{stack_name}` deleted successfully. Cluster Name: {redis_cluster_name}")
        send_slack_message(f"✅ Stack `{stack_name}` deleted successfully.\n*Cluster*: `{redis_cluster_name}`", region, aws_account_id, "Delete")

        return {
            "statusCode": 200,
            "body": json.dumps({
                "message": "Stack deletion completed",
                "stackName": stack_name,
                "region": region,
                "awsAccountId": aws_account_id,
                "redisClusterName": redis_cluster_name,
                "action": "Delete"
            })
        }

    except Exception as e:
        print(f"❌ Error deleting stack: {str(e)}")
        send_slack_message(f"❌ Stack `{stack_name}` deletion failed. Error: {str(e)}", region, aws_account_id, "Delete")
        return {"statusCode": 500, "body": json.dumps({"error": str(e)})}


def send_slack_message(message, region, aws_account_id, action):
    """Send a message to Slack"""
    try:
        payload = {
            "text": f"{message}\n\n*Region:* `{region}`\n*AWS Account ID:* `{aws_account_id}`\n*Action:* `{action}`"
        }
        encoded_payload = json.dumps(payload).encode("utf-8")

        response = http.request(
            "POST",
            SLACK_WEBHOOK_URL,
            body=encoded_payload,
            headers={"Content-Type": "application/json"},
        )

        print(f"Slack message sent: {message}")
        return response.status

    except Exception as e:
        print(f"Error sending Slack message: {str(e)}")

