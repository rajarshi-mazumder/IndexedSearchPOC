export interface CandidateStopRequestScheduler {
  allowPendingStopRequest(): Promise<void>;
}
