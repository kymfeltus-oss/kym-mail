-- The originally specified kym.com addresses could not be provisioned.
-- Use the owner-controlled KYM Mail production domain for real mail identities.
update public.mail_accounts
set email_address = case email_address
  when 'kym@kym.com' then 'kym@kymmailapp.com'
  when 'info@kym.com' then 'info@kymmailapp.com'
  else email_address
end,
updated_at = now()
where email_address in ('kym@kym.com', 'info@kym.com');
