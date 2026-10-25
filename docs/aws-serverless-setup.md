# AWS preparation for the candidate prototype

Target: Tokyo (`ap-northeast-1`), OpenSearch Serverless **NextGen VECTORSEARCH**,
Bedrock `amazon.titan-embed-text-v2:0`, 1024 dimensions.

These are preparation instructions. The application setup command only installs
resources inside an existing collection.

## Provisioned local demo

The approved prototype has been provisioned in Tokyo:

- NextGen collection and group: `indexed-search-dev`.
- Dedicated application IAM user/profile: `indexed-search-demo`.
- Bedrock invocation role: `IndexedSearchBedrockRole`.
- Demo index: `candidates-demo-titan-v2`.
- Ingest/search pipelines: `candidate-demo-titan-v2-ingest` and
  `candidate-demo-titan-v2-hybrid`.
- Group minimum indexing/search capacity: 0/0; maximum: 2/2 OCUs.

Local `.env` contains the endpoint and model ID. The non-secret resource inventory
is in `.cache/aws-demo-resources.json`. The application's access key is stored only
in the dedicated profile in the local AWS credentials file. The default AWS profile
is preserved.

`scripts/provision-demo-aws.py` records the CLI provisioning process and can reuse
matching named resources. It uses the default profile for administration. Daily
indexing/search commands use the restricted application profile instead.

The following sections also document manual preparation for another environment.

## 1. Collection and cost settings

Create a NextGen collection group and a vector-search collection, for example
`indexed-search-dev`. Set the group's minimum indexing and search capacity to
**0**, and maximum indexing and search capacity to **2 OCUs each**. This allows
compute to scale to zero after 10 minutes without requests. These capacity limits
are not a monthly dollar cap.

For local prototype access, the collection network policy must allow access from
your computer. A public collection endpoint still requires IAM authentication and
data access authorization; public network access does not grant document access.
A VPC endpoint is an alternative if the application runs within that network.

Use AWS-owned encryption for this prototype. Copy the collection endpoint into
`OPENSEARCH_NODE`. Keep its region and `AWS_REGION` consistent. The collection
must be NextGen because this application relies on custom document IDs for vector
document updates.

The application disables optional GPU index-build acceleration in the index
settings. No paid OpenSearch Ingestion pipeline is required.

Set AWS Budget alerts at the spending thresholds you prefer (for example, $25
and $50). Alerts notify; they do not stop resources. Avoid recurring health checks
or polling during idle periods if you want scale-to-zero savings.

Official references:
[NextGen vector collections](https://docs.aws.amazon.com/opensearch-service/latest/developerguide/serverless-vector-search.html),
[scale to zero](https://docs.aws.amazon.com/opensearch-service/latest/developerguide/serverless-scale-to-zero.html),
[capacity controls](https://docs.aws.amazon.com/opensearch-service/latest/developerguide/serverless-scaling.html).

## 2. Bedrock invocation role

Create an IAM role and put its ARN in `BEDROCK_ROLE_ARN`. Its trust policy must allow
the Serverless ML service to assume it:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Service": "ml.opensearchservice.amazonaws.com" },
    "Action": "sts:AssumeRole"
  }]
}
```

Attach the following invocation policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": "bedrock:InvokeModel",
    "Resource": "arn:aws:bedrock:ap-northeast-1::foundation-model/amazon.titan-embed-text-v2:0"
  }]
}
```

This is an on-demand Bedrock model; no provisioned model endpoint is needed.
The connector stores the role ARN rather than AWS access keys.

[Serverless ML permissions](https://docs.aws.amazon.com/opensearch-service/latest/developerguide/serverless-configure-machine-learning.html),
[AWS service connectors](https://docs.aws.amazon.com/opensearch-service/latest/developerguide/ml-amazon-connector.html).

## 3. Application/setup principal

Use an AWS profile for an IAM user or role that has access to this collection.
For the prototype, one principal can perform setup and runtime calls. Replace
`COLLECTION_ARN` and `BEDROCK_ROLE_ARN` in this identity policy with real ARNs:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "aoss:APIAccessAll",
      "Resource": "COLLECTION_ARN"
    },
    {
      "Effect": "Allow",
      "Action": "iam:PassRole",
      "Resource": "BEDROCK_ROLE_ARN"
    }
  ]
}
```

The collection ARN contains the **collection ID**. Collection and IAM resource
creation permissions belong to the account's deployment/admin principal.

Configure the collection data access policy as follows. Replace
`APP_PRINCIPAL_ARN` with the IAM user or role ARN associated with the AWS profile,
and change `indexed-search-dev` if you choose another collection name:

```json
[
  {
    "Description": "Candidate prototype setup and runtime",
    "Principal": ["APP_PRINCIPAL_ARN"],
    "Rules": [
      {
        "ResourceType": "index",
        "Resource": ["index/indexed-search-dev/*"],
        "Permission": [
          "aoss:CreateIndex", "aoss:DescribeIndex", "aoss:UpdateIndex",
          "aoss:ReadDocument", "aoss:WriteDocument"
        ]
      },
      {
        "ResourceType": "collection",
        "Resource": ["collection/indexed-search-dev"],
        "Permission": [
          "aoss:CreateCollectionItems", "aoss:DescribeCollectionItems",
          "aoss:UpdateCollectionItems"
        ]
      },
      {
        "ResourceType": "model",
        "Resource": ["model/indexed-search-dev/*"],
        "Permission": [
          "aoss:CreateMLResource", "aoss:DescribeMLResource", "aoss:ExecuteMLResource"
        ]
      }
    ]
  }
]
```

The IAM identity policy and Serverless data access policy are both necessary.
A runtime-only principal can omit setup write permissions and `iam:PassRole`;
it needs document read/write, pipeline access, and model execution according to
the commands it runs. Configure separate read-only search credentials if needed.

[Supported API permissions](https://docs.aws.amazon.com/opensearch-service/latest/developerguide/serverless-genref.html),
[Serverless neural and hybrid search](https://docs.aws.amazon.com/opensearch-service/latest/developerguide/serverless-configure-neural-search.html).

## 4. Application setup and live check

Fill in `.env` using `.env.example`, then run:

```powershell
aws sts get-caller-identity --profile your-profile
npm run setup-opensearch
```

Save the printed OpenSearch model ID in `.env`. The setup command validates the
connector by making a real embedding request through an inline ingest simulation.

After setup becomes visible, authenticate Salesforce using the chosen org alias
and start with a small, known set of contacts:

```powershell
sf org login web --alias your-org-alias
npm run index-candidates -- 003000000000001
npm run search -- "the skills on that candidate"
```

Use an actual Contact ID and wait about 10-15 seconds after indexing. Confirm both
exact skill matches and synonymous queries with your real data before a full load.
The CLI hybrid score is a ranking value, not a confidence percentage.

For `403` responses, check the AWS profile identity, `aoss:APIAccessAll`, network
policy, collection data policy, model execution permission, and Bedrock role.
For an embedding failure, verify `iam:PassRole`, the role trust principal, and
`bedrock:InvokeModel`. A collection can be reachable while these operations are
still unauthorized.

## Cleanup

Use the AWS console or your deployment tooling to remove this prototype collection,
its group when unused, and the IAM/network/data access resources created for it.
Deleting local source code does not stop AWS charges. Removing the collection also
removes its candidate index, pipelines, and registered ML resources.
