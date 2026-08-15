# RLS Matrix

Generated: 2026-08-14T20:15:00.000Z

Tenant relations: 148; protected: 148; policies: 655; exceptions: 0;

| Relation | RLS | Force RLS | Policy | Command | USING | WITH CHECK |
| --- | --- | --- | --- | --- | --- | --- |
| quote_email_challenges | yes | yes | quote_email_challenges_tenant_policy | ALL | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| quote_email_challenges | yes | yes | quote_email_challenges_ingress_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| quote_draft_sections | yes | yes | quote_draft_sections_tenant_policy | ALL | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| content_outbox_events | yes | yes | content_outbox_events_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| content_outbox_events | yes | yes | content_outbox_events_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| content_outbox_events | yes | yes | content_outbox_events_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| content_outbox_events | yes | yes | content_outbox_events_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| payment_records | yes | yes | payment_records_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| payment_records | yes | yes | payment_records_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| payment_records | yes | yes | payment_records_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| payment_records | yes | yes | payment_records_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| agreement_recipients | yes | yes | agreement_recipients_tenant_policy | ALL | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| agreement_recipients | yes | yes | agreement_public_ingress_policy | ALL | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| agreement_recipients | yes | yes | agreement_recipients_prompt21_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| agreement_recipients | yes | yes | agreement_recipients_prompt21_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| agreement_recipients | yes | yes | agreement_recipients_prompt21_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| agreement_recipients | yes | yes | agreement_recipients_prompt21_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| integration_connections | yes | yes | integration_connections_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| integration_connections | yes | yes | integration_connections_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| integration_connections | yes | yes | integration_connections_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| integration_connections | yes | yes | integration_connections_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| content_reviews | yes | yes | content_reviews_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| content_reviews | yes | yes | content_reviews_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| content_reviews | yes | yes | content_reviews_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| content_reviews | yes | yes | content_reviews_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| commercial_tax_rates | yes | yes | quote_prompt9_tenant_policy | ALL | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| assignment_queues | yes | yes | assignment_queues_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| assignment_queues | yes | yes | assignment_queues_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| assignment_queues | yes | yes | assignment_queues_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| assignment_queues | yes | yes | assignment_queues_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| receivable_plans | yes | yes | receivable_plans_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| receivable_plans | yes | yes | receivable_plans_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| receivable_plans | yes | yes | receivable_plans_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| receivable_plans | yes | yes | receivable_plans_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| project_outbox_events | yes | yes | project_outbox_events_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| project_outbox_events | yes | yes | project_outbox_events_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| project_outbox_events | yes | yes | project_outbox_events_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| project_outbox_events | yes | yes | project_outbox_events_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| integration_secret_values | yes | yes | integration_secret_values_runtime_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| integration_secret_values | yes | yes | integration_secret_values_runtime_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| integration_secret_values | yes | yes | integration_secret_values_runtime_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| integration_secret_values | yes | yes | integration_secret_values_runtime_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| agreement_recipient_links | yes | yes | agreement_recipient_links_tenant_policy | ALL | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| agreement_recipient_links | yes | yes | agreement_recipient_links_ingress_lookup | SELECT | (active AND (expires_at > now())) |  |
| agreement_recipient_links | yes | yes | agreement_recipient_links_prompt21_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| agreement_recipient_links | yes | yes | agreement_recipient_links_prompt21_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| agreement_recipient_links | yes | yes | agreement_recipient_links_prompt21_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| agreement_recipient_links | yes | yes | agreement_recipient_links_prompt21_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| project_phases | yes | yes | project_phases_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| project_phases | yes | yes | project_phases_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| project_phases | yes | yes | project_phases_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| project_phases | yes | yes | project_phases_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| sales_state_history | yes | yes | sales_state_history_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| sales_state_history | yes | yes | sales_state_history_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| sales_state_history | yes | yes | sales_state_history_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| sales_state_history | yes | yes | sales_state_history_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| agreement_versions | yes | yes | agreement_versions_tenant_policy | ALL | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| agreement_versions | yes | yes | agreement_versions_ingress_policy | ALL | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| agreement_versions | yes | yes | agreement_versions_prompt21_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| agreement_versions | yes | yes | agreement_versions_prompt21_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| agreement_versions | yes | yes | agreement_versions_prompt21_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| agreement_versions | yes | yes | agreement_versions_prompt21_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| sales_stage_history | yes | yes | sales_stage_history_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| sales_stage_history | yes | yes | sales_stage_history_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| sales_stage_history | yes | yes | sales_stage_history_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| sales_stage_history | yes | yes | sales_stage_history_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| paypal_profiles | yes | yes | paypal_profiles_prompt21_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| paypal_profiles | yes | yes | paypal_profiles_prompt21_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| paypal_profiles | yes | yes | paypal_profiles_prompt21_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| paypal_profiles | yes | yes | paypal_profiles_prompt21_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| assignment_queue_members | yes | yes | assignment_queue_members_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| assignment_queue_members | yes | yes | assignment_queue_members_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| assignment_queue_members | yes | yes | assignment_queue_members_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| assignment_queue_members | yes | yes | assignment_queue_members_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| crm_contacts | yes | yes | crm_contacts_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| crm_contacts | yes | yes | crm_contacts_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| crm_contacts | yes | yes | crm_contacts_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| crm_contacts | yes | yes | crm_contacts_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| sales_pipelines | yes | yes | sales_pipelines_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| sales_pipelines | yes | yes | sales_pipelines_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| sales_pipelines | yes | yes | sales_pipelines_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| sales_pipelines | yes | yes | sales_pipelines_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| stripe_profiles | yes | yes | stripe_profiles_prompt21_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| stripe_profiles | yes | yes | stripe_profiles_prompt21_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| stripe_profiles | yes | yes | stripe_profiles_prompt21_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| stripe_profiles | yes | yes | stripe_profiles_prompt21_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| payment_attempts | yes | yes | payment_attempts_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| payment_attempts | yes | yes | payment_attempts_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| payment_attempts | yes | yes | payment_attempts_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| payment_attempts | yes | yes | payment_attempts_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| quote_items | yes | yes | quote_items_tenant_policy | ALL | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| quote_items | yes | yes | quote_items_ingress_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| quote_items | yes | yes | quote_items_prompt21_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| quote_items | yes | yes | quote_items_prompt21_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| quote_items | yes | yes | quote_items_prompt21_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| quote_items | yes | yes | quote_items_prompt21_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| crm_account_tags | yes | yes | crm_account_tags_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| crm_account_tags | yes | yes | crm_account_tags_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| crm_account_tags | yes | yes | crm_account_tags_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| crm_account_tags | yes | yes | crm_account_tags_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| quote_drafts | yes | yes | quote_drafts_tenant_policy | ALL | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| crm_contact_tags | yes | yes | crm_contact_tags_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| crm_contact_tags | yes | yes | crm_contact_tags_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| crm_contact_tags | yes | yes | crm_contact_tags_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| crm_contact_tags | yes | yes | crm_contact_tags_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| payment_outbox_events | yes | yes | payment_outbox_events_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| payment_outbox_events | yes | yes | payment_outbox_events_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| payment_outbox_events | yes | yes | payment_outbox_events_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| payment_outbox_events | yes | yes | payment_outbox_events_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| project_task_checklist_items | yes | yes | project_task_checklist_items_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| project_task_checklist_items | yes | yes | project_task_checklist_items_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| project_task_checklist_items | yes | yes | project_task_checklist_items_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| project_task_checklist_items | yes | yes | project_task_checklist_items_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| content_ideas | yes | yes | content_ideas_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| content_ideas | yes | yes | content_ideas_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| content_ideas | yes | yes | content_ideas_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| content_ideas | yes | yes | content_ideas_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| payment_requests | yes | yes | payment_requests_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| payment_requests | yes | yes | payment_requests_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| payment_requests | yes | yes | payment_requests_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| payment_requests | yes | yes | payment_requests_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| business_calendar_exceptions | yes | yes | business_calendar_exceptions_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| business_calendar_exceptions | yes | yes | business_calendar_exceptions_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| business_calendar_exceptions | yes | yes | business_calendar_exceptions_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| business_calendar_exceptions | yes | yes | business_calendar_exceptions_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| automation_events | yes | yes | automation_events_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| automation_events | yes | yes | automation_events_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| automation_events | yes | yes | automation_events_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| automation_events | yes | yes | automation_events_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| tenant_memberships | yes | yes | tenant_memberships_prompt21_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| tenant_memberships | yes | yes | tenant_memberships_prompt21_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| tenant_memberships | yes | yes | tenant_memberships_prompt21_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| tenant_memberships | yes | yes | tenant_memberships_prompt21_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| project_activation_policies | yes | yes | project_activation_policies_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| project_activation_policies | yes | yes | project_activation_policies_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| project_activation_policies | yes | yes | project_activation_policies_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| project_activation_policies | yes | yes | project_activation_policies_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| sales_domain_events | yes | yes | sales_domain_events_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| sales_domain_events | yes | yes | sales_domain_events_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| sales_domain_events | yes | yes | sales_domain_events_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| sales_domain_events | yes | yes | sales_domain_events_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| agreement_clause_versions | yes | yes | agreement_clause_versions_tenant_policy | ALL | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| business_calendars | yes | yes | business_calendars_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| business_calendars | yes | yes | business_calendars_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| business_calendars | yes | yes | business_calendars_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| business_calendars | yes | yes | business_calendars_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| sales_opportunities | yes | yes | sales_opportunities_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| sales_opportunities | yes | yes | sales_opportunities_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| sales_opportunities | yes | yes | sales_opportunities_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| sales_opportunities | yes | yes | sales_opportunities_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| quote_draft_items | yes | yes | quote_draft_items_tenant_policy | ALL | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| quote_outbox_events | yes | yes | quote_outbox_tenant_policy | ALL | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| quote_number_sequences | yes | yes | quote_number_sequences_tenant_policy | ALL | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| quote_number_sequences | yes | yes | quote_number_sequences_prompt21_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| quote_number_sequences | yes | yes | quote_number_sequences_prompt21_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| quote_number_sequences | yes | yes | quote_number_sequences_prompt21_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| quote_number_sequences | yes | yes | quote_number_sequences_prompt21_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| inbox_conversation_notes | yes | yes | inbox_conversation_notes_runtime_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| inbox_conversation_notes | yes | yes | inbox_conversation_notes_runtime_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| inbox_conversation_notes | yes | yes | inbox_conversation_notes_runtime_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| inbox_conversation_notes | yes | yes | inbox_conversation_notes_runtime_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| project_number_sequences | yes | yes | project_number_sequences_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| project_number_sequences | yes | yes | project_number_sequences_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| project_number_sequences | yes | yes | project_number_sequences_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| project_number_sequences | yes | yes | project_number_sequences_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| tenant_invitations | yes | yes | tenant_invitations_prompt21_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| tenant_invitations | yes | yes | tenant_invitations_prompt21_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| tenant_invitations | yes | yes | tenant_invitations_prompt21_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| tenant_invitations | yes | yes | tenant_invitations_prompt21_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| manual_payment_submissions | yes | yes | manual_payment_submissions_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| manual_payment_submissions | yes | yes | manual_payment_submissions_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| manual_payment_submissions | yes | yes | manual_payment_submissions_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| manual_payment_submissions | yes | yes | manual_payment_submissions_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| automation_rule_runs | yes | yes | automation_rule_runs_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| automation_rule_runs | yes | yes | automation_rule_runs_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| automation_rule_runs | yes | yes | automation_rule_runs_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| automation_rule_runs | yes | yes | automation_rule_runs_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| mercado_pago_profiles | yes | yes | mercado_pago_profiles_prompt21_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| mercado_pago_profiles | yes | yes | mercado_pago_profiles_prompt21_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| mercado_pago_profiles | yes | yes | mercado_pago_profiles_prompt21_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| mercado_pago_profiles | yes | yes | mercado_pago_profiles_prompt21_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| automation_rules | yes | yes | automation_rules_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| automation_rules | yes | yes | automation_rules_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| automation_rules | yes | yes | automation_rules_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| automation_rules | yes | yes | automation_rules_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| content_variants | yes | yes | content_variants_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| content_variants | yes | yes | content_variants_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| content_variants | yes | yes | content_variants_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| content_variants | yes | yes | content_variants_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| inbox_integration_jobs | yes | yes | inbox_integration_jobs_runtime_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| inbox_integration_jobs | yes | yes | inbox_integration_jobs_runtime_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| inbox_integration_jobs | yes | yes | inbox_integration_jobs_runtime_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| inbox_integration_jobs | yes | yes | inbox_integration_jobs_runtime_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| inbox_integration_jobs | yes | yes | inbox_integration_jobs_service_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| inbox_integration_jobs | yes | yes | inbox_integration_jobs_service_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| inbox_integration_jobs | yes | yes | inbox_integration_jobs_service_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| agreement_drafts | yes | yes | agreement_drafts_tenant_policy | ALL | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| agreement_drafts | yes | yes | agreement_drafts_prompt21_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| agreement_drafts | yes | yes | agreement_drafts_prompt21_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| agreement_drafts | yes | yes | agreement_drafts_prompt21_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| agreement_drafts | yes | yes | agreement_drafts_prompt21_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| portal_outbox_events | yes | yes | portal_outbox_events_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| portal_outbox_events | yes | yes | portal_outbox_events_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| portal_outbox_events | yes | yes | portal_outbox_events_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| portal_outbox_events | yes | yes | portal_outbox_events_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| portal_deliverable_decisions | yes | yes | portal_deliverable_decisions_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| portal_deliverable_decisions | yes | yes | portal_deliverable_decisions_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| portal_deliverable_decisions | yes | yes | portal_deliverable_decisions_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| portal_deliverable_decisions | yes | yes | portal_deliverable_decisions_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| resource_reminders | yes | yes | resource_reminders_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| resource_reminders | yes | yes | resource_reminders_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| resource_reminders | yes | yes | resource_reminders_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| resource_reminders | yes | yes | resource_reminders_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| receivable_installments | yes | yes | receivable_installments_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| receivable_installments | yes | yes | receivable_installments_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| receivable_installments | yes | yes | receivable_installments_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| receivable_installments | yes | yes | receivable_installments_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| editorial_brands | yes | yes | editorial_brands_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| editorial_brands | yes | yes | editorial_brands_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| editorial_brands | yes | yes | editorial_brands_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| editorial_brands | yes | yes | editorial_brands_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| inbox_conversations | yes | yes | inbox_conversations_runtime_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| inbox_conversations | yes | yes | inbox_conversations_runtime_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| inbox_conversations | yes | yes | inbox_conversations_runtime_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| inbox_conversations | yes | yes | inbox_conversations_runtime_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| agreement_outbox_events | yes | yes | agreement_outbox_events_tenant_policy | ALL | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| agreement_outbox_events | yes | yes | agreement_outbox_events_prompt21_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| agreement_outbox_events | yes | yes | agreement_outbox_events_prompt21_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| agreement_outbox_events | yes | yes | agreement_outbox_events_prompt21_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| agreement_outbox_events | yes | yes | agreement_outbox_events_prompt21_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| portal_messages | yes | yes | portal_messages_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| portal_messages | yes | yes | portal_messages_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| portal_messages | yes | yes | portal_messages_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| portal_messages | yes | yes | portal_messages_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| content_items | yes | yes | content_items_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| content_items | yes | yes | content_items_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| content_items | yes | yes | content_items_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| content_items | yes | yes | content_items_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| agreement_internal_reviews | yes | yes | agreement_internal_reviews_tenant_policy | ALL | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| automation_action_runs | yes | yes | automation_action_runs_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| automation_action_runs | yes | yes | automation_action_runs_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| automation_action_runs | yes | yes | automation_action_runs_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| automation_action_runs | yes | yes | automation_action_runs_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| agreement_template_versions | yes | yes | agreement_template_versions_tenant_policy | ALL | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| project_templates | yes | yes | project_templates_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| project_templates | yes | yes | project_templates_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| project_templates | yes | yes | project_templates_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| project_templates | yes | yes | project_templates_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| payment_adjustments | yes | yes | payment_adjustments_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| payment_adjustments | yes | yes | payment_adjustments_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| payment_adjustments | yes | yes | payment_adjustments_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| payment_adjustments | yes | yes | payment_adjustments_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| inbox_webhook_receipts | yes | yes | inbox_webhook_receipts_runtime_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| inbox_webhook_receipts | yes | yes | inbox_webhook_receipts_runtime_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| inbox_webhook_receipts | yes | yes | inbox_webhook_receipts_runtime_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| inbox_webhook_receipts | yes | yes | inbox_webhook_receipts_runtime_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| inbox_webhook_receipts | yes | yes | inbox_webhook_receipts_service_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| inbox_webhook_receipts | yes | yes | inbox_webhook_receipts_service_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| inbox_webhook_receipts | yes | yes | inbox_webhook_receipts_service_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| editorial_campaigns | yes | yes | editorial_campaigns_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| editorial_campaigns | yes | yes | editorial_campaigns_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| editorial_campaigns | yes | yes | editorial_campaigns_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| editorial_campaigns | yes | yes | editorial_campaigns_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| sla_instances | yes | yes | sla_instances_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| sla_instances | yes | yes | sla_instances_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| sla_instances | yes | yes | sla_instances_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| sla_instances | yes | yes | sla_instances_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| security_audit_events | yes | yes | security_audit_events_prompt21_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| security_audit_events | yes | yes | security_audit_events_prompt21_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| security_audit_events | yes | yes | security_audit_events_prompt21_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| security_audit_events | yes | yes | security_audit_events_prompt21_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| payment_secret_values | yes | yes | payment_secret_values_prompt21_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| payment_secret_values | yes | yes | payment_secret_values_prompt21_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| payment_secret_values | yes | yes | payment_secret_values_prompt21_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| payment_secret_values | yes | yes | payment_secret_values_prompt21_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| sales_lead_sources | yes | yes | sales_lead_sources_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| sales_lead_sources | yes | yes | sales_lead_sources_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| sales_lead_sources | yes | yes | sales_lead_sources_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| sales_lead_sources | yes | yes | sales_lead_sources_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| project_template_selection_rules | yes | yes | project_template_selection_rules_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| project_template_selection_rules | yes | yes | project_template_selection_rules_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| project_template_selection_rules | yes | yes | project_template_selection_rules_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| project_template_selection_rules | yes | yes | project_template_selection_rules_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| project_tasks | yes | yes | project_tasks_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| project_tasks | yes | yes | project_tasks_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| project_tasks | yes | yes | project_tasks_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| project_tasks | yes | yes | project_tasks_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| projects | yes | yes | projects_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| projects | yes | yes | projects_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| projects | yes | yes | projects_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| projects | yes | yes | projects_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| agreement_external_execution_records | yes | yes | agreement_external_execution_records_tenant_policy | ALL | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| agreement_external_execution_records | yes | yes | agreement_external_execution_records_prompt21_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| agreement_external_execution_records | yes | yes | agreement_external_execution_records_prompt21_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| agreement_external_execution_records | yes | yes | agreement_external_execution_records_prompt21_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| agreement_external_execution_records | yes | yes | agreement_external_execution_records_prompt21_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| crm_account_notes | yes | yes | crm_account_notes_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| crm_account_notes | yes | yes | crm_account_notes_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| crm_account_notes | yes | yes | crm_account_notes_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| crm_account_notes | yes | yes | crm_account_notes_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| project_template_versions | yes | yes | project_template_versions_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| project_template_versions | yes | yes | project_template_versions_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| project_template_versions | yes | yes | project_template_versions_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| project_template_versions | yes | yes | project_template_versions_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| agreement_acceptance_actions | yes | yes | agreement_acceptance_actions_tenant_policy | ALL | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| agreement_acceptance_actions | yes | yes | agreement_actions_ingress_policy | ALL | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| agreement_acceptance_actions | yes | yes | agreement_acceptance_actions_prompt21_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| agreement_acceptance_actions | yes | yes | agreement_acceptance_actions_prompt21_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| agreement_acceptance_actions | yes | yes | agreement_acceptance_actions_prompt21_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| agreement_acceptance_actions | yes | yes | agreement_acceptance_actions_prompt21_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| agreements | yes | yes | agreements_tenant_policy | ALL | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| agreements | yes | yes | agreements_ingress_policy | ALL | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| agreements | yes | yes | agreements_prompt21_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| agreements | yes | yes | agreements_prompt21_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| agreements | yes | yes | agreements_prompt21_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| agreements | yes | yes | agreements_prompt21_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| internal_notifications | yes | yes | internal_notifications_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| internal_notifications | yes | yes | internal_notifications_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| internal_notifications | yes | yes | internal_notifications_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| internal_notifications | yes | yes | internal_notifications_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| inbox_channel_identities | yes | yes | inbox_channel_identities_runtime_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| inbox_channel_identities | yes | yes | inbox_channel_identities_runtime_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| inbox_channel_identities | yes | yes | inbox_channel_identities_runtime_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| inbox_channel_identities | yes | yes | inbox_channel_identities_runtime_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| inbox_forms | yes | yes | inbox_forms_runtime_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| inbox_forms | yes | yes | inbox_forms_runtime_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| inbox_forms | yes | yes | inbox_forms_runtime_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| inbox_forms | yes | yes | inbox_forms_runtime_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| inbox_forms | yes | yes | inbox_forms_ingress_public_select | SELECT | (status = 'active'::inbox_form_status) |  |
| quotes | yes | yes | quotes_ingress_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| quotes | yes | yes | quotes_tenant_policy | ALL | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| quotes | yes | yes | quotes_prompt21_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| quotes | yes | yes | quotes_prompt21_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| quotes | yes | yes | quotes_prompt21_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| quotes | yes | yes | quotes_prompt21_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| integration_provider_events | yes | yes | integration_provider_events_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| integration_provider_events | yes | yes | integration_provider_events_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| integration_provider_events | yes | yes | integration_provider_events_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| integration_provider_events | yes | yes | integration_provider_events_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| sales_pipeline_stages | yes | yes | sales_pipeline_stages_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| sales_pipeline_stages | yes | yes | sales_pipeline_stages_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| sales_pipeline_stages | yes | yes | sales_pipeline_stages_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| sales_pipeline_stages | yes | yes | sales_pipeline_stages_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| portal_brand_profiles | yes | yes | portal_brand_profiles_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| portal_brand_profiles | yes | yes | portal_brand_profiles_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| portal_brand_profiles | yes | yes | portal_brand_profiles_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| portal_brand_profiles | yes | yes | portal_brand_profiles_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| crm_tags | yes | yes | crm_tags_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| crm_tags | yes | yes | crm_tags_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| crm_tags | yes | yes | crm_tags_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| crm_tags | yes | yes | crm_tags_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| sales_activities | yes | yes | sales_activities_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| sales_activities | yes | yes | sales_activities_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| sales_activities | yes | yes | sales_activities_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| sales_activities | yes | yes | sales_activities_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| portal_domains | yes | yes | portal_domains_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| portal_domains | yes | yes | portal_domains_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| portal_domains | yes | yes | portal_domains_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| portal_domains | yes | yes | portal_domains_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| business_calendar_intervals | yes | yes | business_calendar_intervals_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| business_calendar_intervals | yes | yes | business_calendar_intervals_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| business_calendar_intervals | yes | yes | business_calendar_intervals_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| business_calendar_intervals | yes | yes | business_calendar_intervals_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| agreement_evidence_bundles | yes | yes | agreement_evidence_bundles_tenant_policy | ALL | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| agreement_evidence_bundles | yes | yes | agreement_evidence_bundles_prompt21_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| agreement_evidence_bundles | yes | yes | agreement_evidence_bundles_prompt21_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| agreement_evidence_bundles | yes | yes | agreement_evidence_bundles_prompt21_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| agreement_evidence_bundles | yes | yes | agreement_evidence_bundles_prompt21_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| project_activations | yes | yes | project_activations_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| project_activations | yes | yes | project_activations_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| project_activations | yes | yes | project_activations_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| project_activations | yes | yes | project_activations_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| quote_versions | yes | yes | quote_versions_tenant_policy | ALL | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| quote_versions | yes | yes | quote_versions_prompt21_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| quote_versions | yes | yes | quote_versions_prompt21_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| quote_versions | yes | yes | quote_versions_prompt21_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| quote_versions | yes | yes | quote_versions_prompt21_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| crm_accounts | yes | yes | crm_accounts_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| crm_accounts | yes | yes | crm_accounts_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| crm_accounts | yes | yes | crm_accounts_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| crm_accounts | yes | yes | crm_accounts_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| crm_commercial_audit_events | yes | yes | crm_commercial_audit_events_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| crm_commercial_audit_events | yes | yes | crm_commercial_audit_events_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| crm_commercial_audit_events | yes | yes | crm_commercial_audit_events_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| crm_commercial_audit_events | yes | yes | crm_commercial_audit_events_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| inbox_conversation_assignments | yes | yes | inbox_conversation_assignments_runtime_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| inbox_conversation_assignments | yes | yes | inbox_conversation_assignments_runtime_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| inbox_conversation_assignments | yes | yes | inbox_conversation_assignments_runtime_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| inbox_conversation_assignments | yes | yes | inbox_conversation_assignments_runtime_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| payment_exceptions | yes | yes | payment_exceptions_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| payment_exceptions | yes | yes | payment_exceptions_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| payment_exceptions | yes | yes | payment_exceptions_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| payment_exceptions | yes | yes | payment_exceptions_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| crm_contact_notes | yes | yes | crm_contact_notes_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| crm_contact_notes | yes | yes | crm_contact_notes_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| crm_contact_notes | yes | yes | crm_contact_notes_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| crm_contact_notes | yes | yes | crm_contact_notes_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| inbox_conversation_reads | yes | yes | inbox_conversation_reads_runtime_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| inbox_conversation_reads | yes | yes | inbox_conversation_reads_runtime_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| inbox_conversation_reads | yes | yes | inbox_conversation_reads_runtime_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| inbox_conversation_reads | yes | yes | inbox_conversation_reads_runtime_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| payment_allocations | yes | yes | payment_allocations_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| payment_allocations | yes | yes | payment_allocations_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| payment_allocations | yes | yes | payment_allocations_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| payment_allocations | yes | yes | payment_allocations_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| inbox_message_status_events | yes | yes | inbox_message_status_events_runtime_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| inbox_message_status_events | yes | yes | inbox_message_status_events_runtime_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| inbox_message_status_events | yes | yes | inbox_message_status_events_runtime_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| inbox_message_status_events | yes | yes | inbox_message_status_events_runtime_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| portal_accesses | yes | yes | portal_accesses_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| portal_accesses | yes | yes | portal_accesses_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| portal_accesses | yes | yes | portal_accesses_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| portal_accesses | yes | yes | portal_accesses_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| crm_communication_consent_events | yes | yes | crm_communication_consent_events_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| crm_communication_consent_events | yes | yes | crm_communication_consent_events_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| crm_communication_consent_events | yes | yes | crm_communication_consent_events_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| crm_communication_consent_events | yes | yes | crm_communication_consent_events_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| agreement_clause_blocks | yes | yes | agreement_clause_blocks_tenant_policy | ALL | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| agreement_review_policies | yes | yes | agreement_review_policies_tenant_policy | ALL | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| project_task_dependencies | yes | yes | project_task_dependencies_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| project_task_dependencies | yes | yes | project_task_dependencies_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| project_task_dependencies | yes | yes | project_task_dependencies_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| project_task_dependencies | yes | yes | project_task_dependencies_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| portal_deliverables | yes | yes | portal_deliverables_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| portal_deliverables | yes | yes | portal_deliverables_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| portal_deliverables | yes | yes | portal_deliverables_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| portal_deliverables | yes | yes | portal_deliverables_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| portal_project_conversations | yes | yes | portal_project_conversations_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| portal_project_conversations | yes | yes | portal_project_conversations_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| portal_project_conversations | yes | yes | portal_project_conversations_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| portal_project_conversations | yes | yes | portal_project_conversations_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| member_work_availability | yes | yes | member_work_availability_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| member_work_availability | yes | yes | member_work_availability_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| member_work_availability | yes | yes | member_work_availability_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| member_work_availability | yes | yes | member_work_availability_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| payment_connections | yes | yes | payment_connections_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| payment_connections | yes | yes | payment_connections_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| payment_connections | yes | yes | payment_connections_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| payment_connections | yes | yes | payment_connections_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| quote_client_decisions | yes | yes | quote_client_decisions_tenant_policy | ALL | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| quote_client_decisions | yes | yes | quote_prompt9_ingress_policy | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| payment_provider_events | yes | yes | payment_provider_events_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| payment_provider_events | yes | yes | payment_provider_events_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| payment_provider_events | yes | yes | payment_provider_events_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| payment_provider_events | yes | yes | payment_provider_events_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| notification_preferences | yes | yes | notification_preferences_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| notification_preferences | yes | yes | notification_preferences_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| notification_preferences | yes | yes | notification_preferences_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| notification_preferences | yes | yes | notification_preferences_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| meta_whatsapp_configs | yes | yes | meta_whatsapp_configs_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| meta_whatsapp_configs | yes | yes | meta_whatsapp_configs_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| meta_whatsapp_configs | yes | yes | meta_whatsapp_configs_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| meta_whatsapp_configs | yes | yes | meta_whatsapp_configs_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| quote_public_links | yes | yes | quote_public_links_tenant_policy | ALL | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| quote_public_links | yes | yes | quote_public_links_ingress_lookup | SELECT | (active AND ((expires_at IS NULL) OR (expires_at > now()))) |  |
| quote_public_links | yes | yes | quote_public_links_prompt21_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| quote_public_links | yes | yes | quote_public_links_prompt21_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| quote_public_links | yes | yes | quote_public_links_prompt21_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| quote_public_links | yes | yes | quote_public_links_prompt21_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| sla_policy_versions | yes | yes | sla_policy_versions_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| sla_policy_versions | yes | yes | sla_policy_versions_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| sla_policy_versions | yes | yes | sla_policy_versions_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| sla_policy_versions | yes | yes | sla_policy_versions_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| sla_instance_events | yes | yes | sla_instance_events_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| sla_instance_events | yes | yes | sla_instance_events_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| sla_instance_events | yes | yes | sla_instance_events_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| sla_instance_events | yes | yes | sla_instance_events_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| crm_contact_methods | yes | yes | crm_contact_methods_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| crm_contact_methods | yes | yes | crm_contact_methods_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| crm_contact_methods | yes | yes | crm_contact_methods_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| crm_contact_methods | yes | yes | crm_contact_methods_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| oauth_authorization_attempts | yes | yes | oauth_authorization_attempts_prompt21_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| oauth_authorization_attempts | yes | yes | oauth_authorization_attempts_prompt21_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| oauth_authorization_attempts | yes | yes | oauth_authorization_attempts_prompt21_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| oauth_authorization_attempts | yes | yes | oauth_authorization_attempts_prompt21_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| sales_opportunity_participants | yes | yes | sales_opportunity_participants_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| sales_opportunity_participants | yes | yes | sales_opportunity_participants_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| sales_opportunity_participants | yes | yes | sales_opportunity_participants_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| sales_opportunity_participants | yes | yes | sales_opportunity_participants_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| meta_whatsapp_templates | yes | yes | meta_whatsapp_templates_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| meta_whatsapp_templates | yes | yes | meta_whatsapp_templates_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| meta_whatsapp_templates | yes | yes | meta_whatsapp_templates_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| meta_whatsapp_templates | yes | yes | meta_whatsapp_templates_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| editorial_pillars | yes | yes | editorial_pillars_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| editorial_pillars | yes | yes | editorial_pillars_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| editorial_pillars | yes | yes | editorial_pillars_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| editorial_pillars | yes | yes | editorial_pillars_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| sales_lost_reasons | yes | yes | sales_lost_reasons_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| sales_lost_reasons | yes | yes | sales_lost_reasons_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| sales_lost_reasons | yes | yes | sales_lost_reasons_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| sales_lost_reasons | yes | yes | sales_lost_reasons_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| portal_deliverable_versions | yes | yes | portal_deliverable_versions_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| portal_deliverable_versions | yes | yes | portal_deliverable_versions_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| portal_deliverable_versions | yes | yes | portal_deliverable_versions_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| portal_deliverable_versions | yes | yes | portal_deliverable_versions_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| agreement_envelopes | yes | yes | agreement_envelopes_tenant_policy | ALL | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| agreement_envelopes | yes | yes | agreement_envelopes_ingress_policy | ALL | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| agreement_envelopes | yes | yes | agreement_envelopes_prompt21_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| agreement_envelopes | yes | yes | agreement_envelopes_prompt21_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| agreement_envelopes | yes | yes | agreement_envelopes_prompt21_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| agreement_envelopes | yes | yes | agreement_envelopes_prompt21_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| waha_session_bindings | yes | yes | waha_session_bindings_prompt21_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| waha_session_bindings | yes | yes | waha_session_bindings_prompt21_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| waha_session_bindings | yes | yes | waha_session_bindings_prompt21_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| waha_session_bindings | yes | yes | waha_session_bindings_prompt21_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| inbox_connections | yes | yes | inbox_connections_runtime_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| inbox_connections | yes | yes | inbox_connections_runtime_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| inbox_connections | yes | yes | inbox_connections_runtime_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| inbox_connections | yes | yes | inbox_connections_runtime_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| crm_account_contacts | yes | yes | crm_account_contacts_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| crm_account_contacts | yes | yes | crm_account_contacts_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| crm_account_contacts | yes | yes | crm_account_contacts_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| crm_account_contacts | yes | yes | crm_account_contacts_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| inbox_webhook_routes | yes | yes | inbox_webhook_routes_prompt21_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| inbox_webhook_routes | yes | yes | inbox_webhook_routes_prompt21_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| inbox_webhook_routes | yes | yes | inbox_webhook_routes_prompt21_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| inbox_webhook_routes | yes | yes | inbox_webhook_routes_prompt21_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| quote_public_sessions | yes | yes | quote_public_sessions_tenant_policy | ALL | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| quote_public_sessions | yes | yes | quote_public_sessions_ingress_lookup | SELECT | ((revoked_at IS NULL) AND (expires_at > now())) |  |
| project_activation_approvals | yes | yes | project_activation_approvals_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| project_activation_approvals | yes | yes | project_activation_approvals_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| project_activation_approvals | yes | yes | project_activation_approvals_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| project_activation_approvals | yes | yes | project_activation_approvals_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| portal_access_project_scopes | yes | yes | portal_access_project_scopes_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| portal_access_project_scopes | yes | yes | portal_access_project_scopes_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| portal_access_project_scopes | yes | yes | portal_access_project_scopes_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| portal_access_project_scopes | yes | yes | portal_access_project_scopes_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| inbox_messages | yes | yes | inbox_messages_runtime_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| inbox_messages | yes | yes | inbox_messages_runtime_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| inbox_messages | yes | yes | inbox_messages_runtime_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| inbox_messages | yes | yes | inbox_messages_runtime_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| project_plan_versions | yes | yes | project_plan_versions_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| project_plan_versions | yes | yes | project_plan_versions_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| project_plan_versions | yes | yes | project_plan_versions_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| project_plan_versions | yes | yes | project_plan_versions_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| content_notes | yes | yes | content_notes_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| content_notes | yes | yes | content_notes_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| content_notes | yes | yes | content_notes_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| content_notes | yes | yes | content_notes_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| inbox_attachments | yes | yes | inbox_attachments_runtime_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| inbox_attachments | yes | yes | inbox_attachments_runtime_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| inbox_attachments | yes | yes | inbox_attachments_runtime_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| inbox_attachments | yes | yes | inbox_attachments_runtime_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| assignment_queue_state | yes | yes | assignment_queue_state_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| assignment_queue_state | yes | yes | assignment_queue_state_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| assignment_queue_state | yes | yes | assignment_queue_state_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| assignment_queue_state | yes | yes | assignment_queue_state_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| automation_rule_versions | yes | yes | automation_rule_versions_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| automation_rule_versions | yes | yes | automation_rule_versions_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| automation_rule_versions | yes | yes | automation_rule_versions_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| automation_rule_versions | yes | yes | automation_rule_versions_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| agreement_public_sessions | yes | yes | agreement_public_sessions_tenant_policy | ALL | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| agreement_public_sessions | yes | yes | agreement_public_sessions_ingress_policy | ALL | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| agreement_public_sessions | yes | yes | agreement_public_sessions_prompt21_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| agreement_public_sessions | yes | yes | agreement_public_sessions_prompt21_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| agreement_public_sessions | yes | yes | agreement_public_sessions_prompt21_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| agreement_public_sessions | yes | yes | agreement_public_sessions_prompt21_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| tenant_messaging_provider_selections | yes | yes | tenant_messaging_provider_selections_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| tenant_messaging_provider_selections | yes | yes | tenant_messaging_provider_selections_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| tenant_messaging_provider_selections | yes | yes | tenant_messaging_provider_selections_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| tenant_messaging_provider_selections | yes | yes | tenant_messaging_provider_selections_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| portal_invitations | yes | yes | portal_invitations_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| portal_invitations | yes | yes | portal_invitations_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| portal_invitations | yes | yes | portal_invitations_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| portal_invitations | yes | yes | portal_invitations_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| agreement_number_sequences | yes | yes | agreement_number_sequences_tenant_policy | ALL | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| agreement_number_sequences | yes | yes | agreement_number_sequences_prompt21_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| agreement_number_sequences | yes | yes | agreement_number_sequences_prompt21_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| agreement_number_sequences | yes | yes | agreement_number_sequences_prompt21_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| agreement_number_sequences | yes | yes | agreement_number_sequences_prompt21_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| business_calendar_versions | yes | yes | business_calendar_versions_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| business_calendar_versions | yes | yes | business_calendar_versions_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| business_calendar_versions | yes | yes | business_calendar_versions_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| business_calendar_versions | yes | yes | business_calendar_versions_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| sla_policies | yes | yes | sla_policies_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| sla_policies | yes | yes | sla_policies_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| sla_policies | yes | yes | sla_policies_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| sla_policies | yes | yes | sla_policies_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| automation_jobs | yes | yes | automation_jobs_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| automation_jobs | yes | yes | automation_jobs_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| automation_jobs | yes | yes | automation_jobs_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| automation_jobs | yes | yes | automation_jobs_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| deposit_requirements | yes | yes | deposit_requirements_tenant_select | SELECT | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| deposit_requirements | yes | yes | deposit_requirements_tenant_insert | INSERT |  | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| deposit_requirements | yes | yes | deposit_requirements_tenant_update | UPDATE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
| deposit_requirements | yes | yes | deposit_requirements_tenant_delete | DELETE | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |  |
| agreement_templates | yes | yes | agreement_templates_tenant_policy | ALL | (tenant_id = current_setting('app.current_tenant_id'::text, true)) | (tenant_id = current_setting('app.current_tenant_id'::text, true)) |
