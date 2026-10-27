import { ConsoleConfiguration, OperationRequest } from "../../shared/candidate-console-contracts";
import { loadOpenSearchConfig, loadOpenSearchSetupConfig } from "./opensearch-config";
import { loadSalesforceConfig } from "./salesforce-config";

export class CandidateConsoleEnvironment {
  static defaults(environment: NodeJS.ProcessEnv): ConsoleConfiguration {
    return { id: "default", name: "Current environment", sfOrg: environment.SF_TARGET_ORG ?? "full",
      awsProfile: environment.AWS_PROFILE ?? "default", awsRegion: environment.AWS_REGION ?? "ap-northeast-1",
      endpoint: environment.OPENSEARCH_NODE ?? "", modelId: environment.OPENSEARCH_MODEL_ID ?? "", roleArn: environment.BEDROCK_ROLE_ARN ?? "",
      index: environment.OPENSEARCH_INDEX ?? "candidates-fsb", automaticPipelines: false,
      ingestPipeline: environment.OPENSEARCH_INGEST_PIPELINE ?? "candidate-titan-v2-ingest",
      searchPipeline: environment.OPENSEARCH_SEARCH_PIPELINE ?? "candidate-titan-v2-hybrid", dataset: "fsb" };
  }
  static create(configuration: ConsoleConfiguration, base: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
    return { ...base, SF_TARGET_ORG: configuration.sfOrg.trim(), AWS_PROFILE: configuration.awsProfile.trim() || undefined,
      AWS_REGION: configuration.awsRegion.trim(), OPENSEARCH_NODE: configuration.endpoint.trim(), OPENSEARCH_MODEL_ID: configuration.modelId.trim(),
      BEDROCK_ROLE_ARN: configuration.roleArn.trim(), OPENSEARCH_INDEX: configuration.index.trim(),
      OPENSEARCH_INGEST_PIPELINE: configuration.automaticPipelines ? configuration.index.trim() + "-ingest" : configuration.ingestPipeline.trim(),
      OPENSEARCH_SEARCH_PIPELINE: configuration.automaticPipelines ? configuration.index.trim() + "-hybrid" : configuration.searchPipeline.trim() };
  }
  static validate(request: OperationRequest, base: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
    const environment = this.create(request.configuration, base);
    if (request.kind === "fetch") loadSalesforceConfig(environment);
    else if (request.kind === "setup") loadOpenSearchSetupConfig(environment);
    else loadOpenSearchConfig(environment);
    return environment;
  }
}
