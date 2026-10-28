# Candidate search POC: 100-candidate benchmark

Live AWS verification completed at **2026-10-25T09:41:15.582Z**. All **280/280 ranking checks passed**.

The dataset contains 100 entirely fictional candidates across 37 industry labels. The original 24 records were retained and 76 were added. Records cover software, healthcare, education, engineering, trades, finance, law, marketing, hospitality, science, social services, and creative work.

## Measured results

| Check | Expected candidate first | Expected candidate in top five | Pass requirement |
| --- | --- | --- | --- |
| Exact-role lexical lookups | 100/100 | 100/100 | First place |
| Role-and-skill hybrid queries | 100/100 | 100/100 | First place |
| Development natural-language hybrid queries | 20/20 | 20/20 | First place |
| Development vector-only queries | 19/20 | 20/20 | Top five |
| Reserved validation hybrid queries | 20/20 | 20/20 | First place |
| Reserved validation vector-only queries | 20/20 | 20/20 | Top five |

**Hybrid search ranked the designated candidate first in all 140 hybrid queries.** Vector-only search ranked the designated candidate first in 39/40 cases and within the top five in 40/40. The vector-only SEO query ranked the paid-advertising specialist first and the SEO specialist second; hybrid search corrected that ordering.

## End-to-end and local verification

- Ran the actual indexing CLI against Amazon OpenSearch Serverless and Bedrock Titan V2.
- Confirmed exactly 100 documents, fresh indexing timestamps, complete candidate DTOs, expected embedding input, and nonzero finite 1,024-dimensional vectors.
- Reindexed two selected IDs, including a duplicate input ID; document count stayed at 100 and the other 98 records were unchanged.
- Verified standalone lexical and vector queries, the hybrid use case, and the displayed search CLI result.
- All 30 offline tests, application/test type checking, and the production build passed.

## Ranking changes and evaluation discipline

1. Baseline: 279/280 checks passed. The unpaid-search-visibility query ranked the SEO specialist second. Its lexical branch returned no matches because the per-field 75% term requirement was too restrictive.
2. Cross-field matching with a 30% term requirement recovered useful lexical evidence, but equal score weights introduced two development regressions: financial analysis and pharmacy. That development run passed 238/240 checks.
3. Weighting normalized scores at 25% lexical and 75% semantic passed 240/240 development checks. The final full reindex and evaluation passed 280/280, including the 20 reserved validation queries in both hybrid and vector-only modes.

The implementation uses `multi_match` with `cross_fields` and `minimum_should_match: "2<30%"`. Candidate evidence can match across fields rather than needing to occur within one field. See the [OpenSearch multi-match documentation](https://docs.opensearch.org/latest/query-dsl/full-text/multi-match/). Fusion still runs in OpenSearch using min-max normalization and a weighted arithmetic mean.

Candidate records and all expected-answer judgments were frozen before the first benchmark and remained identical across every run. Validation judgments were not used to choose the query or weight changes. There are no query-specific rules, candidate-ID boosts, or expected-answer lookups in production search.

## Scope of the result

The 100 role-plus-skill queries are generated from candidate titles and skills; they test precise retrieval, not independent human query quality. The 40 natural-language queries were authored separately before the initial run. Each has one designated correct candidate. They are synthetic judgments, not recruiter-labeled production relevance data.

A 100% hybrid first-place result on these cases does not guarantee a perfect ordering of every returned candidate or perfect results for unseen queries. This evaluation does not cover no-match abstention, multilingual retrieval, ambiguous multi-answer requests, real Salesforce ingestion, or hard location/salary constraints. Search still returns lower-ranked candidates even when only one is a strong fit.

## Fixed natural-language queries

| Split / case | Query | Expected candidate | Hybrid rank | Vector rank |
| --- | --- | --- | --- | --- |
| dev-01 | an engineer who keeps production services running, monitors outages, and restores availability | Site Reliability Engineer | 1 | 1 |
| dev-02 | build accessible web interfaces using React and TypeScript | Frontend Engineer | 1 | 1 |
| dev-03 | prepare company budgets, forecast financial performance, and value the business | Financial Analyst | 1 | 1 |
| dev-04 | a doctor to examine infants, check childhood development, and give children their immunizations | Pediatrician | 1 | 1 |
| dev-05 | check prescriptions for unsafe combinations of medicines and explain the correct dose to patients | Clinical Pharmacist | 1 | 1 |
| dev-06 | help an injured athlete regain movement through rehabilitation exercises and hands-on treatment | Physiotherapist | 1 | 1 |
| dev-07 | adapt classroom instruction for children with learning disabilities and create individual learning plans | Special Education Teacher | 1 | 1 |
| dev-08 | turn employee training material into interactive online courses with clear learning objectives | Instructional Designer | 1 | 1 |
| dev-09 | calculate loads and design reinforced concrete buildings to withstand earthquakes | Structural Engineer | 1 | 1 |
| dev-10 | design photovoltaic installations and estimate their electricity production using PVsyst | Solar Energy Engineer | 1 | 1 |
| dev-11 | repair a leaking water pipe and clear a blocked drain in a building | Plumber | 1 | 1 |
| dev-12 | protect a new invention by researching prior art and preparing a patent application | Patent Attorney | 1 | 1 |
| dev-13 | calculate life insurance premiums and estimate the reserves needed for future claims | Actuary | 1 | 1 |
| dev-14 | improve unpaid visibility on Google by auditing website crawl issues and researching search keywords | SEO Specialist | 1 | 2 |
| dev-15 | make croissants, chocolate desserts, and plated sweets for a bakery | Pastry Chef | 1 | 1 |
| dev-16 | advise farmers on soil fertility, crop pests, and irrigation to increase harvest yields | Agronomist | 1 | 1 |
| dev-17 | study ocean ecosystems and survey coral reefs to support marine conservation | Marine Biologist | 1 | 1 |
| dev-18 | translate technical documents between Japanese and English using terminology databases | Japanese English Translator | 1 | 1 |
| dev-19 | assemble filmed footage, correct its colors, and add motion graphics in post production | Video Editor | 1 | 1 |
| dev-20 | provide cognitive behavioral therapy and psychological assessment for people coping with trauma | Clinical Psychologist | 1 | 1 |
| val-01 | build pipelines that move retail data into a warehouse with Airflow and Spark | Data Engineer | 1 | 1 |
| val-02 | investigate suspicious security alerts and hunt for attacks using Splunk | Cybersecurity Analyst | 1 | 1 |
| val-03 | care for critically ill patients at the bedside and manage their ventilators | Intensive Care Nurse | 1 | 1 |
| val-04 | interpret MRI and CT scans and report the medical findings | Diagnostic Radiologist | 1 | 1 |
| val-05 | diagnose sick pets, perform surgery on animals, and advise their owners | Veterinarian | 1 | 1 |
| val-06 | teach teenagers algebra, geometry, and calculus and prepare them for examinations | Secondary Mathematics Teacher | 1 | 1 |
| val-07 | design electrical substations and coordinate protective relays on the power grid | Electrical Power Engineer | 1 | 1 |
| val-08 | design systems that clean wastewater and monitor water pollution | Environmental Engineer | 1 | 1 |
| val-09 | service heat pumps and repair air conditioning and refrigeration equipment | HVAC Technician | 1 | 1 |
| val-10 | program CNC lathes and milling machines to make precision metal components | CNC Machinist | 1 | 1 |
| val-11 | independently examine company financial statements and test accounting controls under IFRS | External Auditor | 1 | 1 |
| val-12 | assess whether commercial borrowers will repay loans and model their probability of default | Credit Risk Analyst | 1 | 1 |
| val-13 | select industrial suppliers and negotiate purchase agreements using SAP Ariba | Procurement Manager | 1 | 1 |
| val-14 | help SaaS customers adopt a product, renew their subscriptions, and avoid cancellation | Customer Success Manager | 1 | 1 |
| val-15 | run hotel guest services, coordinate housekeeping, and manage room revenue | Hotel Operations Manager | 1 | 1 |
| val-16 | supervise a distribution center, improve order picking, and control warehouse stock | Warehouse Manager | 1 | 1 |
| val-17 | coordinate clinical trial participants, obtain informed consent, and maintain study records | Clinical Research Coordinator | 1 | 1 |
| val-18 | support vulnerable families through casework, safeguarding, and community referrals | Social Worker | 1 | 1 |
| val-19 | record musicians, mix their tracks, and master the audio in Pro Tools | Audio Engineer | 1 | 1 |
| val-20 | help people regain independence in daily activities by assessing their needs and providing adaptive equipment | Occupational Therapist | 1 | 1 |

## Reproduce and inspect

```powershell
npm run test:e2e
npm run search -- "improve unpaid visibility on Google by auditing website crawl issues and researching search keywords"
```

`test:e2e` re-embeds the fixtures and makes billed AWS requests. `verify-demo` runs the same retrieval checks on existing stored documents without reindexing. The raw report contains all queries, returned IDs and scores, ranks, metrics, and the actual deployed search pipeline.

- [Final raw report](../.cache/search-benchmarks/2026-10-25T09-41-15-582Z-all.json) (local ignored artifact).
- [Candidate records](../backend/dataPreparation/infrastructure/fixtures/dummyCandidates.ts).
- [Fixed natural-language judgments](../tests/candidate-search-benchmark-cases.ts).
- Index: `candidates-demo-titan-v2`.
- Registered model: `83e4421c-528f-475c-bff6-b652eae6d27f`.
- Candidate SHA-256: `307cffb23715121b008a2390951dda5f0aacedefa77bfc2d84086a462b81d04b`.
- Judgment SHA-256: `35d1e472cc3309f4a4452e6cfcf35708fa85484c71b45279c6ec84fcc1ab3a55`.
- Hybrid search code SHA-256: `f43559649fdec35b5a3df5dc6599b1abacfe7004a1d14749ac4d5dab8970dd71`.
