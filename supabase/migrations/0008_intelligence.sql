-- M6: the demo dataset has 500 synthetic customers, about 217 of them consenting to research.
-- At the production default of 50 every state cell is suppressed, so the demo threshold is 10.
-- The code default stays 50 (lib/intelligence/settings.ts); this row is data, editable from /intelligence.
update settings set value = '10'::jsonb where key = 'min_cohort';
