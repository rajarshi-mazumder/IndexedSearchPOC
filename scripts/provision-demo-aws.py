"""Provision the approved Tokyo prototype with AWS CLI. Never print credentials."""
import configparser
import json
import os
from pathlib import Path
import subprocess


ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / ".cache"
CACHE.mkdir(exist_ok=True)
REGION = "ap-northeast-1"
NAME = "indexed-search-dev"
PROFILE = "indexed-search-demo"
USER = "indexed-search-demo"
ROLE = "IndexedSearchBedrockRole"
MODEL = "amazon.titan-embed-text-v2:0"


def aws(service, operation, payload=None, profile="default", missing=None):
    args = ["aws", service, operation, "--profile", profile, "--region", REGION,
            "--output", "json", "--no-cli-pager"]
    if payload is not None:
        request_file = CACHE / "aws-provision-request.json"
        request_file.write_text(json.dumps(payload), encoding="utf-8")
        args.extend(["--cli-input-json", "file://" + request_file.as_posix()])
    result = subprocess.run(args, capture_output=True, text=True,
                            env={**os.environ, "AWS_EC2_METADATA_DISABLED": "true"})
    if result.returncode:
        if missing and missing in result.stderr:
            return None
        raise RuntimeError(service + " " + operation + ": " + result.stderr.strip())
    return json.loads(result.stdout) if result.stdout.strip() else {}


def ensure_policy(kind, payload):
    service_type = "access" if kind == "data" else "security"
    current = aws("opensearchserverless", "get-" + service_type + "-policy",
                  {"type": kind, "name": NAME}, missing="ResourceNotFoundException")
    if current is None:
        aws("opensearchserverless", "create-" + service_type + "-policy", {
            "type": kind, "name": NAME, "policy": json.dumps(payload),
            "description": "IndexedSearch prototype " + kind + " policy",
        })
        print("Created " + kind + " policy", flush=True)
    else:
        detail = current[service_type + "PolicyDetail"]
        existing = detail["policy"]
        if isinstance(existing, str):
            existing = json.loads(existing)
        if existing != payload:
            raise RuntimeError("Existing " + kind + " policy differs; inspect it before modifying.")


def save_profile(expected_user_arn):
    credentials_path = Path(os.environ.get("AWS_SHARED_CREDENTIALS_FILE", Path.home() / ".aws" / "credentials"))
    credentials = configparser.RawConfigParser()
    credentials.read(credentials_path, encoding="utf-8")
    if credentials.has_section(PROFILE):
        identity = aws("sts", "get-caller-identity", profile=PROFILE)
        if identity["Arn"] != expected_user_arn:
            raise RuntimeError("Existing prototype profile belongs to another principal")
        print("Reused application AWS profile", flush=True)
        return
    keys = aws("iam", "list-access-keys", {"UserName": USER})["AccessKeyMetadata"]
    if keys:
        raise RuntimeError("Application user already has credentials; restore its profile before continuing")
    key = aws("iam", "create-access-key", {"UserName": USER})["AccessKey"]
    credentials.add_section(PROFILE)
    credentials.set(PROFILE, "aws_access_key_id", key["AccessKeyId"])
    credentials.set(PROFILE, "aws_secret_access_key", key["SecretAccessKey"])
    credentials_path.parent.mkdir(parents=True, exist_ok=True)
    with credentials_path.open("w", encoding="utf-8") as handle:
        credentials.write(handle)
    # Store region separately; preserve existing profile values.
    config_path = Path(os.environ.get("AWS_CONFIG_FILE", Path.home() / ".aws" / "config"))
    configuration = configparser.RawConfigParser()
    configuration.read(config_path, encoding="utf-8")
    section = "profile " + PROFILE
    if not configuration.has_section(section):
        configuration.add_section(section)
    configuration.set(section, "region", REGION)
    with config_path.open("w", encoding="utf-8") as handle:
        configuration.write(handle)
    print("Saved dedicated application credentials to the local AWS profile", flush=True)


if __name__ == "__main__":
    identity = aws("sts", "get-caller-identity")
    account = identity["Account"]
    role_arn = "arn:aws:iam::" + account + ":role/" + ROLE
    user_arn = "arn:aws:iam::" + account + ":user/" + USER
    state_file = CACHE / "aws-demo-resources.json"
    if state_file.exists() and json.loads(state_file.read_text())["account"] != account:
        raise RuntimeError("Existing deployment state belongs to another AWS account")

    if aws("iam", "get-user", {"UserName": USER}, missing="NoSuchEntity") is None:
        aws("iam", "create-user", {"UserName": USER, "Tags": [{"Key": "Project", "Value": "IndexedSearch"}]})
        print("Created application IAM user", flush=True)
    if aws("iam", "get-role", {"RoleName": ROLE}, missing="NoSuchEntity") is None:
        aws("iam", "create-role", {
            "RoleName": ROLE,
            "AssumeRolePolicyDocument": json.dumps({"Version": "2012-10-17", "Statement": [{
                "Effect": "Allow", "Principal": {"Service": "ml.opensearchservice.amazonaws.com"},
                "Action": "sts:AssumeRole",
            }]}),
            "Tags": [{"Key": "Project", "Value": "IndexedSearch"}],
        })
        print("Created Bedrock invocation role", flush=True)
    aws("iam", "put-role-policy", {
        "RoleName": ROLE, "PolicyName": "InvokeTitanV2",
        "PolicyDocument": json.dumps({"Version": "2012-10-17", "Statement": [{
            "Effect": "Allow", "Action": "bedrock:InvokeModel",
            "Resource": "arn:aws:bedrock:" + REGION + "::foundation-model/" + MODEL,
        }]}),
    })

    groups = aws("opensearchserverless", "list-collection-groups")["collectionGroupSummaries"]
    if not any(group["name"] == NAME for group in groups):
        aws("opensearchserverless", "create-collection-group", {
            "name": NAME, "generation": "NEXTGEN", "standbyReplicas": "ENABLED",
            "capacityLimits": {"minIndexingCapacityInOCU": 0, "minSearchCapacityInOCU": 0,
                               "maxIndexingCapacityInOCU": 2, "maxSearchCapacityInOCU": 2},
            "tags": [{"key": "Project", "value": "IndexedSearch"}],
        })
        print("Created NextGen collection group: min 0, max 2 OCUs per component", flush=True)

    ensure_policy("network", [{
        "Description": "Local prototype clients with IAM authentication",
        "Rules": [{"ResourceType": "collection", "Resource": ["collection/" + NAME]}],
        "AllowFromPublic": True,
    }])
    ensure_policy("data", [{
        "Description": "Candidate prototype setup and runtime",
        "Principal": [user_arn],
        "Rules": [
            {"ResourceType": "index", "Resource": ["index/" + NAME + "/*"], "Permission": [
                "aoss:CreateIndex", "aoss:DescribeIndex", "aoss:UpdateIndex", "aoss:ReadDocument", "aoss:WriteDocument"]},
            {"ResourceType": "collection", "Resource": ["collection/" + NAME], "Permission": [
                "aoss:CreateCollectionItems", "aoss:DescribeCollectionItems", "aoss:UpdateCollectionItems"]},
            {"ResourceType": "model", "Resource": ["model/" + NAME + "/*"], "Permission": [
                "aoss:CreateMLResource", "aoss:DescribeMLResource", "aoss:ExecuteMLResource"]},
        ],
    }])

    collections = aws("opensearchserverless", "list-collections")["collectionSummaries"]
    existing = next((item for item in collections if item["name"] == NAME), None)
    if existing:
        collection = aws("opensearchserverless", "batch-get-collection", {"ids": [existing["id"]]})["collectionDetails"][0]
    else:
        collection = aws("opensearchserverless", "create-collection", {
            "name": NAME, "type": "VECTORSEARCH", "collectionGroupName": NAME,
            "standbyReplicas": "ENABLED", "encryptionConfig": {"aWSOwnedKey": True},
            "description": "Fictional candidate hybrid search prototype",
            "tags": [{"key": "Project", "value": "IndexedSearch"}],
        })["createCollectionDetail"]
        print("Created NextGen vector collection", flush=True)

    aws("iam", "put-user-policy", {
        "UserName": USER, "PolicyName": "CandidateCollectionAccess",
        "PolicyDocument": json.dumps({"Version": "2012-10-17", "Statement": [
            {"Effect": "Allow", "Action": "aoss:APIAccessAll", "Resource": collection["arn"]},
            {"Effect": "Allow", "Action": "iam:PassRole", "Resource": role_arn},
        ]}),
    })
    save_profile(user_arn)
    state = {"account": account, "region": REGION, "collectionName": NAME,
             "collectionGroupName": NAME, "collectionId": collection["id"],
             "collectionArn": collection["arn"], "bedrockRoleArn": role_arn,
             "applicationUserArn": user_arn, "profile": PROFILE}
    state_file.write_text(json.dumps(state, indent=2) + "\n", encoding="utf-8")
    print("Provisioning submitted. Collection status: " + collection["status"], flush=True)
    print("Resource IDs saved to .cache/aws-demo-resources.json (no credentials).", flush=True)
