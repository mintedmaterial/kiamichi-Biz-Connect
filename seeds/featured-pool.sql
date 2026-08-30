-- Operational featured pool keyed by stable business slugs.
-- Apply after business data is imported; safe to rerun.

INSERT OR IGNORE INTO featured_tier_members (business_id, tier_level, notes)
SELECT id, 'free', 'Curated featured pool'
FROM businesses
WHERE slug IN (
  'dalton-avenue-flowers-gifts',
  'strain-plumbing',
  'twisted-custom-leather',
  'valliant-storage',
  'velvet-fringe',
  'srvcflo-web-marketing-design',
  'shredz-fitness-and-personal-training',
  'ringold-cafe',
  'nation-heat-and-air',
  'mossy-oak-properties-rustin-bryant',
  'lonestar-heat-and-air',
  'lolli-pops-diner',
  'jones-heating-air',
  'jailhouse-feed',
  'idabel-heat-air',
  'hunny-dos-hardware',
  'hocha-cool',
  'creekside-outdoor-spaces',
  'davis-multi-service-contracting',
  'a-salon-vanessa-s-place-hair-salon-barbering'
);

UPDATE businesses
SET is_featured = 1
WHERE slug IN (
  'dalton-avenue-flowers-gifts',
  'strain-plumbing',
  'twisted-custom-leather',
  'valliant-storage',
  'velvet-fringe',
  'srvcflo-web-marketing-design'
);

UPDATE featured_slots
SET business_id = (SELECT id FROM businesses WHERE slug = 'dalton-avenue-flowers-gifts'),
    priority_source = 'rotation'
WHERE slot_position = 1
  AND EXISTS (SELECT 1 FROM businesses WHERE slug = 'dalton-avenue-flowers-gifts');

UPDATE featured_slots
SET business_id = (SELECT id FROM businesses WHERE slug = 'strain-plumbing'),
    priority_source = 'rotation'
WHERE slot_position = 2
  AND EXISTS (SELECT 1 FROM businesses WHERE slug = 'strain-plumbing');

UPDATE featured_slots
SET business_id = (SELECT id FROM businesses WHERE slug = 'twisted-custom-leather'),
    priority_source = 'rotation'
WHERE slot_position = 3
  AND EXISTS (SELECT 1 FROM businesses WHERE slug = 'twisted-custom-leather');

UPDATE featured_slots
SET business_id = (SELECT id FROM businesses WHERE slug = 'valliant-storage'),
    priority_source = 'rotation'
WHERE slot_position = 4
  AND EXISTS (SELECT 1 FROM businesses WHERE slug = 'valliant-storage');

UPDATE featured_slots
SET business_id = (SELECT id FROM businesses WHERE slug = 'velvet-fringe'),
    priority_source = 'rotation'
WHERE slot_position = 5
  AND EXISTS (SELECT 1 FROM businesses WHERE slug = 'velvet-fringe');

UPDATE featured_slots
SET business_id = (SELECT id FROM businesses WHERE slug = 'srvcflo-web-marketing-design'),
    priority_source = 'rotation'
WHERE slot_position = 6
  AND EXISTS (SELECT 1 FROM businesses WHERE slug = 'srvcflo-web-marketing-design');
