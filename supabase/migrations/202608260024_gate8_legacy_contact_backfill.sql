update public.job_contact_searches s
set project_id = (
  select association.project_id
  from public.job_opportunity_projects association
  where association.owner_id = s.owner_id and association.job_opportunity_id = s.job_opportunity_id
  order by association.associated_at
  limit 1
)
where s.project_id is null and exists (
  select 1 from public.job_opportunity_projects association
  where association.owner_id = s.owner_id and association.job_opportunity_id = s.job_opportunity_id
);

update public.job_contacts contact
set project_id = (
      select association.project_id
      from public.job_opportunity_projects association
      where association.owner_id = contact.owner_id and association.job_opportunity_id = contact.job_opportunity_id
      order by association.associated_at
      limit 1
    ),
    research_version = greatest(contact.research_version, coalesce((
      select search.search_version
      from public.job_contact_searches search
      where search.owner_id = contact.owner_id and search.job_opportunity_id = contact.job_opportunity_id
    ), 1)),
    recommendation_label = case
      when contact.classifications @> array['SYSTEMS_LEADER']::public.contact_classification[] then 'Relevant Finance Systems Leader'
      when contact.classifications @> array['ACCOUNTING_LEADER']::public.contact_classification[] then 'Recommended Accounting Leader'
      when contact.classifications @> array['FINANCE_LEADER']::public.contact_classification[] then 'Recommended Finance Leader'
      when contact.classifications @> array['EXECUTIVE_SPONSOR']::public.contact_classification[] then 'Likely Relevant Executive'
      when contact.classifications @> array['RECRUITER']::public.contact_classification[] then 'Recruiting Contact'
      else contact.recommendation_label
    end
where contact.project_id is null or contact.research_version = 0 or contact.recommendation_label = 'Relevant Professional';
