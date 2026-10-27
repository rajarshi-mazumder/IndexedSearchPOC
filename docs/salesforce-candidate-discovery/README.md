# Salesforce candidate extraction: queries to validate before implementation

Implementation status: the [main README](../../README.md#enriched-candidate-exports)
now describes the association-based extractor and migration commands. These queries
remain useful for validating your org's mappings and discovering the still-unverified
history objects. Runtime preflight checks metadata; no live sandbox query results
have been supplied in this repository.

Run this guide against the **`full` sandbox** and share the results before we
implement the richer extraction. These are read-only Salesforce queries; they
do not fetch the entire sandbox, index documents, or invoke embeddings.

The field names in the screenshots are discovery hypotheses until confirmed by
your org's metadata. The current implementation reads a few TagConnector slots;
we want to establish the complete Contact -> TagAssociation -> Tag relationship,
readable labels, employer details, and verified professional history sources.

## 1. Start here: metadata and record types

Run these commands in the repository folder. They work in Git Bash or PowerShell.
Save their output as the filenames shown, or copy the complete JSON response.
No Salesforce access tokens or `sf org display --verbose` output are needed.

```sh
sf sobject describe --target-org full --sobject Contact --json > contact-describe.json
sf sobject describe --target-org full --sobject TagAssociation__c --json > tag-association-describe.json
sf sobject describe --target-org full --sobject Tag__c --json > tag-describe.json
sf sobject describe --target-org full --sobject Account --json > account-describe.json
sf sobject describe --target-org full --sobject TagConnector__c --json > tag-connector-describe.json
sf data query --target-org full --query "SELECT Id, SobjectType, Name, DeveloperName FROM RecordType WHERE SobjectType IN ('Contact', 'Tag__c') ORDER BY SobjectType, DeveloperName" --json > record-types.json
```

An object/field error is useful evidence: share the exact error instead of
substituting an API name by guesswork. Namespaced objects may have different names.

The describe results tell us:

- Actual field names, types, accessibility, and picklist values.
- Lookup `referenceTo` and `relationshipName` values.
- Contact `childRelationships`: child object, linking field, relationship name.
- Whether tags have `label__c`, `tagParent__c`, and the expected record types.
- Whether the Contact-to-TagConnector relationship in the current code is valid.

**First handoff:** send these six results. We can verify the remaining query
templates from those results before you run them. Full describe JSON is preferable
to a screenshot because field/relationship lists are long.

## 2. How to run the remaining queries

Each SQL block below is SOQL. Copy one into a local `.soql` file, replace its
placeholder IDs with real IDs, and execute it like this:

```sh
sf data query --target-org full --file candidate-core.soql --json > candidate-core.json
```

Use a corresponding filename for each block, such as `candidate-associations.soql`.
Do not paste Markdown fences into the file. `CANDIDATE_ID_1`, `TAG_ID_1`, etc. are
placeholders, not executable Salesforce IDs. Keep the quotes around real IDs.
For a single candidate, use `IN ('REAL_ID')` rather than leaving extra placeholders.

In Developer Console's Query Editor, use ordinary SOQL for data queries. Only
section 9's EntityDefinition discovery uses **Use Tooling API** in this guide.
CLI JSON avoids nested relationships being rendered as `[object Object]` in a UI.
The flat queries here also make the joins easy to inspect.

Keep raw results local and untracked. When sharing, names and identifying free
text can be redacted; preserve consistent ID substitutions across files so joins
remain testable. We need tag labels and professional evidence, not email/phone.

## 3. Choose a small, meaningful candidate sample

Choose **3-5 Contact IDs**, including:

1. The known Java candidate from your existing exported batch.
2. A candidate with many skills/tags in Salesforce.
3. A candidate whose current JSON has empty skills.
4. If available, a candidate with language proficiency and career/education history.

Prefer IDs you already know from Salesforce or the JSON. This ensures we can
compare the same candidates end to end, rather than relying on random Contacts.

After confirming the Contact record-type developer names in section 1, this is
an optional way to find a small candidate sample:

```sql
SELECT Id, Name, Title, RecordTypeId, RecordType.DeveloperName, LastModifiedDate
FROM Contact
WHERE RecordType.DeveloperName IN ('Candidate', 'CandidatePreReg')
ORDER BY Id ASC
LIMIT 10
```

Replace those developer names if your metadata differs. No status/dummy filter
is applied here: we must decide that scope explicitly. The earlier count of
1,254,365 Contacts does not establish the number of candidate records.

## 4. Candidate core profile

Start with standard fields for the chosen IDs:

```sql
SELECT Id, Name, Title, AccountId, RecordTypeId,
       MailingCity, MailingState, MailingCountry, LastModifiedDate
FROM Contact
WHERE Id IN ('CANDIDATE_ID_1', 'CANDIDATE_ID_2')
ORDER BY Id ASC
```

Once section 1 confirms the custom field names and their types, run this
extended template for the **same IDs**. If a field is absent/inaccessible, tell
us which one and omit it explicitly; do not interpret that omission as a null
value on the candidate.

```sql
SELECT Id, Name, Title, AccountId, RecordTypeId,
       desiredTitle__c, currentPositionStartDate__c, positionLevel__c,
       jobType__c, currentSalary__c, currentMonthlySalary__c,
       desiredSalary__c, noticePeriod__c, location__c,
       MailingCity, MailingState, MailingCountry,
       okToRelocate__c, relocateTo__c,
       highestEducationalQualification__c,
       highestEducationalInstitute__c, educationalSpecialization__c,
       peopleManager__c, currentPeopleManaged__c, maxPeopleManaged__c,
       status__c, isDummyCandidate__c, LastModifiedDate
FROM Contact
WHERE Id IN ('CANDIDATE_ID_1', 'CANDIDATE_ID_2')
ORDER BY Id ASC
```

If any apparent text field is a lookup, preserve its ID and use the describe
result to identify its target object before choosing how to resolve its label.
Record salary field types/currency semantics; do not assume annual and monthly
salary are interchangeable. We do not need nationality, visa, recruiter ratings,
or unrelated personal details to diagnose the Java search problem.

## 5. All tag associations for those candidates

Confirm these API names with `tag-association-describe.json` first:

```sql
SELECT Id, candidate__c, firstTag__c, secondTag__c, tagScore__c,
       LastModifiedDate
FROM TagAssociation__c
WHERE candidate__c IN ('CANDIDATE_ID_1', 'CANDIDATE_ID_2')
ORDER BY Id ASC
LIMIT 1000
```

Keep **every association row**, including repeated candidate IDs. Both tag
references matter. The score's meaning must be established from metadata/business
usage; it is not automatically years of experience or a relevance weight.

If a response has exactly 1,000 records, run the next page using its last Id:

```sql
SELECT Id, candidate__c, firstTag__c, secondTag__c, tagScore__c,
       LastModifiedDate
FROM TagAssociation__c
WHERE candidate__c IN ('CANDIDATE_ID_1', 'CANDIDATE_ID_2')
  AND Id > 'LAST_ASSOCIATION_ID_FROM_PREVIOUS_PAGE'
ORDER BY Id ASC
LIMIT 1000
```

Save each page separately and repeat until fewer than 1,000 rows return. Do not
call a capped first page the complete relationship set. Sample only a few
candidates at this stage; do not replace the ID filter with all Contacts.

## 6. Resolve tag labels, types, and parents

Collect distinct non-null IDs from **both** `firstTag__c` and `secondTag__c` in
section 5. Query them in groups of at most 200 IDs for this investigation:

```sql
SELECT Id, Name, label__c, RecordTypeId, tagParent__c, LastModifiedDate
FROM Tag__c
WHERE Id IN ('TAG_ID_1', 'TAG_ID_2')
ORDER BY Id ASC
```

For each returned `tagParent__c` not already retrieved, run the same query with
those parent IDs. Repeat until parents are null or already resolved. Keep each
result file. A repeated ID is not a reason to loop again; report cycles and
references for which no accessible Tag row is returned.

Join `RecordTypeId` to the Tag record types returned in section 1. Send the actual
developer names: we must not invent a mapping of record types to skills, systems,
job functions, industries, or languages.

For a language candidate, include both tags and their types/labels in the sample.
The proposed first-tag language / second-tag proficiency pairing needs validation
against real associations. Unknown types should remain traceable in the export.

### Optional: locate the Java vocabulary entry

Only run after confirming `label__c` exists and is filterable:

```sql
SELECT Id, Name, label__c, RecordTypeId, tagParent__c
FROM Tag__c
WHERE label__c = 'Java' OR Name = 'Java'
ORDER BY Id ASC
LIMIT 100
```

If that returns nothing, a broader *diagnostic* query is:

```sql
SELECT Id, Name, label__c, RecordTypeId, tagParent__c
FROM Tag__c
WHERE label__c LIKE '%Java%' OR Name LIKE '%Java%'
ORDER BY Id ASC
LIMIT 100
```

The broader query may include JavaScript or unrelated terms; those are not Java
experience. It is capped discovery, not a complete vocabulary export. If
`label__c` cannot be filtered, inspect the tags fetched by ID in the main query.

If you need a candidate linked to a confirmed Java tag, use its exact ID:

```sql
SELECT Id, candidate__c, firstTag__c, secondTag__c, tagScore__c
FROM TagAssociation__c
WHERE firstTag__c = 'CONFIRMED_JAVA_TAG_ID'
   OR secondTag__c = 'CONFIRMED_JAVA_TAG_ID'
ORDER BY Id ASC
LIMIT 10
```

Then inspect those Contacts with section 4 to confirm their candidate record type.

## 7. Resolve employers

Collect distinct non-null `AccountId` values from the selected Contacts:

```sql
SELECT Id, Name, Industry, Type, BillingCity, BillingState,
       BillingCountry, Description, Website, LastModifiedDate
FROM Account
WHERE Id IN ('ACCOUNT_ID_1', 'ACCOUNT_ID_2')
ORDER BY Id ASC
```

This establishes the readable employer details. Account industry/description is
employer context, not proof of the candidate's own skills or previous employment.
If the sandbox masks employer names, label resolution cannot undo that masking.

## 8. Compare the old connector with the associations

After checking the Contact relationship and TagConnector fields in section 1,
run this for the same candidates:

```sql
SELECT Id,
       TagConnector__r.SkillCode1__c,
       TagConnector__r.SkillCode2__c,
       TagConnector__r.SkillCode3__c,
       TagConnector__r.SkillCategory1__c,
       TagConnector__r.SkillCategory2__c,
       TagConnector__r.SkillCategory3__c,
       TagConnector__r.Systems1__c,
       TagConnector__r.Systems2__c,
       TagConnector__r.Systems3__c,
       TagConnector__r.Industry__c,
       TagConnector__r.SubIndustry__c,
       TagConnector__r.JobFunction1__c,
       TagConnector__r.JobFunction2__c,
       TagConnector__r.JobFunction3__c,
       TagConnector__r.ENLevel__c,
       TagConnector__r.JPLevel__c,
       TagConnector__r.CNLevel__c
FROM Contact
WHERE Id IN ('CANDIDATE_ID_1', 'CANDIDATE_ID_2')
ORDER BY Id ASC
```

This is a comparison source, not an assumption that the connector is complete.
We need to see whether associations contain additional tags and whether any
connector information has no association equivalent.

## 9. Discover employment, education, and process sources

Start with Contact's `childRelationships` from section 1. Identify objects whose
labels/fields represent employment, education, projects, or professional summaries.
A Salesforce audit object such as ContactHistory is not a career history table.

For additional object-name discovery, save this as `history-objects.soql`:

```sql
SELECT QualifiedApiName, Label
FROM EntityDefinition
WHERE QualifiedApiName LIKE '%History%'
   OR QualifiedApiName LIKE '%Employment%'
   OR QualifiedApiName LIKE '%Education%'
   OR QualifiedApiName LIKE '%Career%'
   OR QualifiedApiName LIKE '%Experience%'
   OR QualifiedApiName LIKE '%Process%'
ORDER BY QualifiedApiName
LIMIT 200
```

```sh
sf data query --target-org full --use-tooling-api --file history-objects.soql --json > history-objects.json
```

This name search is supplementary, capped, and may miss differently named objects.
Share the Contact child relationships even if this query returns no useful rows.
If it reaches 200 rows, report that rather than treating it as a full inventory.

For each likely object, describe it using its **verified API name**:

```sh
sf sobject describe --target-org full --sobject VERIFIED_OBJECT_API_NAME --json > history-object-describe.json
```

The screenshots mention `Process__c`; check its metadata before assuming its role:

```sh
sf sobject describe --target-org full --sobject Process__c --json > process-describe.json
```

Only if that describe confirms `candidate__c` and `status__c`, run:

```sql
SELECT Id, candidate__c, status__c, LastModifiedDate
FROM Process__c
WHERE candidate__c IN ('CANDIDATE_ID_1', 'CANDIDATE_ID_2')
ORDER BY Id ASC
LIMIT 1000
```

Use section 5's last-Id paging pattern if capped. A recruitment process/status is
not employment experience. The exact career/education queries will be added
after we see their object descriptions: candidate lookup, employer/institution,
role/qualification, dates, and description fields. We will also inspect any
verified professional-summary or resume-text fields on Contact. Do not fetch
attachments or guess object/field names to fill this gap.

## 10. What to send back and what we will decide

Start with **section 1's metadata**. After field names are confirmed, send:

| Output | What it validates |
| --- | --- |
| Sample Contact IDs and core profiles | Candidate scope, actual values, lookup fields |
| All association pages for those IDs | Relationship completeness and tag pairing |
| Referenced tags, parent tags, record types | Labels, classification, hierarchy |
| Referenced Accounts | Employer resolution |
| Connector comparison | Data lost by the existing three-slot mapping |
| History discovery and object descriptions | Exact queries for professional history |
| Exact errors and any capped results | Unsupported fields and incomplete evidence |

For the Java example, identify which sample candidate should match and why.
Keep its original exported JSON available, and note the dataset file, index name,
and whether that file was actually embedded into that index. Java in `systems`
already contributes to the current embedding text and lexical query; source
enrichment alone does not establish the cause of poor ranking.

After reviewing these results, we will finalize field/category mappings and
candidate scope, then implement the approved bounded extraction design. Existing
exports/indexes will not be overwritten as part of this investigation. Re-fetching
and re-embedding will be necessary to make newly retrieved fields searchable.

## Command references

- [Salesforce CLI: sobject describe](https://developer.salesforce.com/docs/platform/salesforce-cli-reference/guide/cli_reference_sobject_describe.html) documents the metadata command and flags used above.
- [Salesforce CLI: data query](https://developer.salesforce.com/docs/platform/salesforce-cli-reference/guide/cli_reference_data_query.html) documents SOQL files, JSON results, and Tooling API selection.
- [Salesforce: relationship names](https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-relationships-understanding.html) explains lookup relationship metadata.

CLI syntax was checked against these references. Custom schema and data queries
have **not** been executed against your full sandbox; your results are the
validation step before implementation.
