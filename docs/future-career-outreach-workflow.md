# Locked future Projects and career-outreach architecture

> Status: authoritative product roadmap only. Projects and the career-outreach workflow are not implemented in Gate 2.

KYM Mail is not merely an email client and will not become a generic job board. Its approved future product sequence is:

> Find the opportunity → understand the opportunity → determine how the owner matches → present the owner appropriately → identify the right decision maker → determine how to reach that person → prepare individualized outreach → send → track the relationship.

Gate 2 Mail Core remains the active implementation scope. After Mail Core achieves PASS, Projects must be evaluated as the next implementation gate before Job Search and Career Intelligence. Documentation here does not authorize Project schema, routes, screens, sample records, job-provider integrations, or AI features during Gate 2.

## Projects are the contextual operating layer

The governing product rule is:

> **Projects provide context. Features perform actions.**

KYM Mail has one Mail system, Compose engine, Job Search engine, Contact Intelligence system, Email Discovery system, Resume Studio, and bounded AI execution layer. A Project supplies validated context to those shared systems; it never creates a project-specific copy of them. Project types must not become separate applications, mailbox implementations, or duplicated domain architectures.

Conceptually:

```text
PROJECT
  ├── supplies context → JOB SEARCH
  ├── supplies context → CONTACT INTELLIGENCE
  ├── supplies context → EMAIL DISCOVERY
  ├── supplies context → RESUME STUDIO
  ├── supplies context → COMPOSE
  └── receives activity ← MAIL / RESPONSES
```

### Global use remains first-class

Projects are optional organizational and contextual containers. Without creating or selecting one, the owner can still read the unified Inbox, open threads, compose ordinary email, search jobs, and access Contacts. Global Job Search may later offer **Save to Project**, and shared Compose may later include an optional `Project: [None]` selection. The application must never force a Project merely to use its global tools.

Intentional outreach can carry Project context so KYM Mail knows why a contact, opportunity, resume, draft, sent message, or response belongs together. This context augments shared records; it does not replace or duplicate them.

### Project creation, types, and lifecycle

The future Create Project flow begins with **What are you working on?** Initial types are:

- Job Search
- Business Outreach
- Partnership
- Networking
- Custom

Use one authoritative Project concept with typed and validated parameters. Do not create separate Project tables or service architectures for each type unless a proven workflow later requires it. Conversely, do not hide all behavior inside a giant untyped JSON object. The implementation gate must choose the smallest typed model that supports its approved workflows.

Core Project information may include only what real workflows require: name, type, objective, status, useful description or notes, default sending identity, creation/update timestamps, and an archive timestamp or state. A simple deterministic lifecycle may use `ACTIVE`, `PAUSED`, `COMPLETED`, and `ARCHIVED`, but only states proven necessary during implementation are approved. Custom Projects remain simple in V1 and must not become a general-purpose workflow builder.

Parameters vary by type and must not force irrelevant fields onto every Project. A Job Search Project may eventually carry target roles, keywords, location, work arrangement, minimum compensation, seniority, outreach-role priorities, a reference to the global Master Career Profile, and a default From identity. A Business Outreach Project may instead carry target organizations or industries, target contact roles, messaging style, approved material, and a default From identity. Partnership and Networking Projects may carry their corresponding organization, people, objective, talking-point, relationship, follow-up, and supporting-material context.

For example, a Job Search Project named **Finance Systems Leadership Search** might supply editable search context such as finance-systems or controller roles, Workday/SAP/automation/ASC 606 keywords, Dallas plus Remote, Director-level seniority, a minimum compensation filter, and `kym@kymmailapp.com` as the default sender. A Business Outreach Project may skip Job Search entirely and instead move from a selected organization to contact research, email intelligence, individualized Compose, delivery, and response tracking.

These examples define parameter direction only. They are not seed data, implemented defaults, or permission to fabricate Projects.

### One coherent Project workspace

A future Project opens into one workspace whose relevant sections may include Overview, Jobs, Contacts, Outreach, Resume Versions, Responses, and Activity. Project type and available functionality determine which sections appear; irrelevant sections stay absent.

Overview must answer what the Project is, its objective, active parameters, real work completed, and what genuinely needs attention next. It must never manufacture activity, statistics, success states, or dashboard content to make a workspace appear populated.

### Context supplied to shared engines

**Job Search.** In a Job Search Project, Project parameters may pre-populate target roles, keywords, location, work arrangement, compensation, and seniority. The owner reviews and may edit them before execution. Global Job Search remains available, and a real result may be saved or associated with a Project. The authoritative `JobOpportunity` remains a single record rather than a Project-owned duplicate.

**Contacts.** A Contact is one authoritative global person even when relevant to multiple Projects. A normalized Project–Contact association may later retain project-specific relevance, outreach role, status, notes, or relationship to a particular opportunity. It must not duplicate the underlying Contact.

**Email Intelligence.** Organization-level domain, email-pattern, candidate, and verification evidence remains authoritative Contact/Organization intelligence. Projects reuse valid evidence; they do not rediscover the same corporate convention independently unless evidence has expired or must be revalidated.

**Compose and sender identity.** Compose remains one shared engine. When an optional Project is selected, it may receive the default From identity, objective, selected Contact, selected JobOpportunity, approved email candidate, ResumeVersion, messaging context, and approved supporting material. A Project default such as `kym@kymmailapp.com` is a convenience rule, not a mailbox; the owner may change From when provider configuration permits it.

**Resume Studio.** The Master Career Profile and Resume Studio remain global. A Project may associate a job-specific `ResumeVersion` derived from the global profile and a real JobOpportunity. It never owns a second Master Career Profile.

**Outreach and responses.** Outreach may connect Project, Contact, Organization, optional JobOpportunity, Message, and optional ResumeVersion so KYM Mail retains the reason for communication. An incoming message in an already associated thread inherits that Project context through the thread; the owner should not need to reassign every response manually.

**Activity.** Project Activity is composed only from persisted events that really occurred, such as Project creation, job save or analysis, Contact association, email verification, ResumeVersion creation, draft/save/send, permitted resume activity, incoming response, or reply. No fake activity is allowed.

### Deterministic ownership and bounded AI

Projects are logic-driven. Deterministic application logic owns Project identity, type, validated parameters, status, default sender, associations, permissions, workflow state, persistence, activity, and the context supplied to shared services. AI never determines authoritative Project state, silently changes parameters, or autonomously sends a message.

Later bounded AI execution may use validated Project context for job analysis, evidence-backed career-match explanations, contact relevance, resume emphasis, message drafting, and response classification. Its output remains subject to the authoritative/derived/presentation separation and the validation and approval rules in the main architecture.

## Locked Project-to-outreach workflow

The career workflow below uses a Job Search Project as its contextual container. Global Job Search remains valid; a globally found opportunity can enter this same sequence by being saved to a Project before project-driven analysis and outreach.

```text
JOB SEARCH PROJECT
  → LOAD PROJECT PARAMETERS
  → OWNER REVIEWS / EDITS SEARCH
  → SEARCH JOBS
  → SELECT JOB
  → SAVE AUTHORITATIVE JOB OPPORTUNITY TO PROJECT
  → ANALYZE JOB DESCRIPTION
  → MATCH MASTER CAREER PROFILE
  → CREATE JOB-SPECIFIC INTERACTIVE RESUME
  → IDENTIFY RELEVANT ACCOUNTING / FINANCE LEADERS AND/OR HIRING MANAGER
  → OWNER SELECTS CONTACT
  → SELECTION TRIGGERS EMAIL INTELLIGENCE
  → VALIDATE CORPORATE DOMAIN
  → DISCOVER EMAIL CONVENTION
  → GENERATE CANDIDATE EMAIL DETERMINISTICALLY
  → VERIFY EMAIL
  → POPULATE RECIPIENT
  → GENERATE INDIVIDUALIZED COVER-LETTER EMAIL
  → INSERT JOB-SPECIFIC INTERACTIVE RESUME
  → OWNER REVIEWS COMPLETE PACKAGE
  → SEND / SCHEDULE
  → TRACK MESSAGE
  → TRACK PERMITTED RESUME ACTIVITY
  → RECEIVE REPLY
  → MATCH RESPONSE TO CONTACT + JOB + PROJECT
  → CLASSIFY RESPONSE
  → SUGGEST NEXT ACTION
  → OWNER APPROVES NEXT COMMUNICATION
  → UPDATE PROJECT ACTIVITY FROM PERSISTED EVENTS
```

## Authoritative provider and normalization boundaries

Future job discovery uses legitimate permitted APIs, feeds, or aggregators behind a vendor-neutral `JobSearchProvider`. Unauthorized scraping is prohibited. Provider results flow through deterministic adapter normalization, validation, deduplication, and provenance capture before an authoritative `JobOpportunity` exists. Missing facts such as compensation, location, company, or dates are never manufactured.

### Keyword-first job search

The primary future search field is labeled **Job title, keywords, skills, or phrases**. It accepts exact or approximate titles, single keywords, multiple keywords, quoted phrases where supported, and combinations of function, skill, technology, and accounting concepts. The owner is not required to know an exact title. Representative searches include `Finance Systems`, `Corporate Controller`, `"ASC 606"`, `Finance Systems Workday`, `Python Accounting`, `Revenue Recognition Automation`, `Director Accounting Systems`, `Finance Transformation SAP`, `NetSuite Controller`, and `Accounting Automation SQL`.

The system preserves the exact `originalQuery` while producing a deterministic normalized representation. Basic parsing is application logic—not an AI task—and handles whitespace, appropriate case normalization, duplicate terms, quoted phrases, empty searches, maximum length, and invalid input. For example, `finance systems Workday automation` may normalize to the distinct concepts `finance systems`, `Workday`, and `automation`. The eventual implementation may support broad concept searches, specific quoted phrases, title plus technology, function plus skill, and accounting plus technology. It should not introduce a custom Boolean language unless a selected provider supports one cleanly.

Keyword queries may combine only with truthful provider-supported filters: city/state, remote/hybrid/onsite, company, salary where supplied, employment type, reliable seniority, and date posted (such as 24 hours, 3, 7, 14, or 30 days). Unsupported or unreliable filters remain hidden.

```text
ORIGINAL USER SEARCH
  → DETERMINISTIC VALIDATION
  → NORMALIZED QUERY
  → SUPPORTED FILTERS
  → JobSearchProvider.search()
  → REAL PROVIDER RESULTS
  → RESULT NORMALIZATION
  → VALIDATION
  → DEDUPLICATION
  → KYM MAIL JOB RESULTS OR TRUTHFUL EMPTY STATE
```

No provider result means no fabricated listing. Search-within-results may later operate on the already returned normalized set when it adds genuine value without needless provider calls.

### Explainable search relevance

After real results return, deterministic logic may rank them using documented factors such as phrase/keyword occurrence in title and description, required/preferred qualification matches, seniority alignment, work-arrangement/location alignment, and compensation alignment where source data exists. External ranking is an input, not the sole authority. The actual scoring model and weights must be established through implementation and tests; no arbitrary percentages are approved by this roadmap.

**Search Relevance** answers how closely a listing matches the current query and filters. **Career Match** separately answers how the opportunity aligns with the authoritative Master Career Profile. Search Relevance is primarily deterministic; Career Match may incorporate validated, evidence-linked derived intelligence. They must never be merged into an unexplained AI score.

When useful, **Why this result** exposes actual normalized evidence: a phrase in the title, technology in requirements, repeated keyword occurrence, matching seniority, or matching remote/location state. AI may later phrase the explanation naturally but does not decide whether the underlying occurrence happened.

### Saved and suggested searches

Future saved searches may preserve editable keywords, location/work arrangement, seniority, compensation, employment type, and date filters. Scheduled monitoring is a separate future capability and is not approved for the initial Job Search gate. A future **Find jobs for me** assistant may suggest editable search terminology from the Master Career Profile; the owner controls the final criteria and the external provider remains the sole source of actual listings.

For search, deterministic logic owns the original query, validation, normalization, filters, provider request/results, result normalization, deduplication, keyword occurrence, relevance, provenance, persistence, and saved state. AI may suggest terminology or later assist after selection, but cannot invent listings, salaries, companies, requirements, alter provider facts, inflate unrelated jobs, or silently change the query.

The selected job owns supported provider IDs, source URL, description, location/work arrangement, compensation when supplied, employment type, posted date, and discovery date. AI may later extract structured requirements only after deterministic input validation. Those requirements are derived intelligence, not authoritative facts.

## Explainable career matching and presentation

Job requirements will be compared with an authoritative Master Career Profile. Material matches must retain Career Fact evidence; unexplained AI scores are prohibited. A job-specific `ResumeVersion` may select, reorder, emphasize, and rewrite presentation without altering employers, titles, dates, credentials, metrics, technologies, supported scope, or factual relationships. The Master Career Profile remains unchanged.

## Decision-maker research

Role-priority logic depends on the opportunity. Accounting/controller work prioritizes accounting leadership; finance-systems work prioritizes systems/transformation leadership; FP&A work prioritizes FP&A/finance leadership. These are research priorities, not proof that someone is the hiring manager. A person may be labeled `Hiring Manager` only with supporting evidence; otherwise use `Recommended Outreach Contact`.

Discovered people become normalized Contacts only with supported names, titles, organizations, relationship, source URL, discovery date, and evidence/confidence state. AI-generated unsupported people or titles never become authoritative records.

## Email intelligence trigger and deterministic address generation

Selecting a decision maker is the trigger for Corporate Email Intelligence. The accepted inputs are the normalized person, organization, and validated corporate domain. Evidence supports an organization-level email convention. Logic—not free-form AI—applies the accepted pattern to the normalized name. The resulting candidate then passes syntax/domain checks and a legitimate verification provider.

Inferred, likely, uncertain, invalid, unknown, and verified/deliverable states must remain distinct. Auto-populating Compose never means auto-sending. Multiple contacts receive independent individualized messages; KYM Mail is not a mass-email system.

## Drafting, review, and approval

Future cover-letter drafting receives validated JobOpportunity, derived requirements/match, selected Contact, Organization, approved email candidate, Master Career Profile, and job-specific ResumeVersion. Factual claims retain authoritative Career Fact provenance. AI cannot invent relationships, experience, credentials, or metrics.

Before delivery, the owner reviews recipient identity/title/company, email verification state, opportunity/match, subject/body, resume, and From identity. The owner may edit, change the contact or sender, review verification and resume, save a draft, and approve send. No autonomous sending is permitted.

## Relationship and response lifecycle

Future first-party ResumeLink activity may record only interactions KYM Mail can actually observe. Incoming Gmail messages continue through Mail Core notification, history sync, message, and thread logic before later optional associations to Contact, JobOpportunity, and Project. Response classification and suggested actions are derived intelligence; the underlying email remains authoritative and the owner approves any reply.

## Governing ownership

Deterministic logic owns provider requests, normalization, validation, deduplication, records, provenance, role priorities, domain acceptance, email patterns, candidate generation, verification states and thresholds, workflow state, recipient population, approval, persistence, delivery/scheduling, and audit history.

AI may execute bounded requirement extraction, interpretation, evidence-backed match explanation, resume emphasis/presentation rewriting, decision-maker relevance assistance, evidence interpretation, drafting, and response classification. AI must never invent jobs, people, titles, domains, addresses, verification, or career facts; bypass state/approval rules; or autonomously send.

## Gate 2 compatibility without speculative schema

Mail Core stores provider-stable mail-account, thread, message, history, and attachment identifiers. Future migrations can add nullable application-owned associations or normalized join tables connecting a message/thread to Contact, JobOpportunity, Project, ResumeVersion, and outreach activity without changing Gmail synchronization or making Gmail authoritative for those concepts. Provider/account identity remains attached to each mail record, while Project context remains application-owned and optional. Gate 2 intentionally creates none of those future models, associations, routes, provider integrations, or interfaces.
