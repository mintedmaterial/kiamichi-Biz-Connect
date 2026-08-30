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

INSERT OR REPLACE INTO featured_slots (
  slot_position,
  business_id,
  priority_source,
  last_rotated
)
SELECT
  CASE slug
    WHEN 'dalton-avenue-flowers-gifts' THEN 1
    WHEN 'strain-plumbing' THEN 2
    WHEN 'twisted-custom-leather' THEN 3
    WHEN 'valliant-storage' THEN 4
    WHEN 'velvet-fringe' THEN 5
    WHEN 'srvcflo-web-marketing-design' THEN 6
  END,
  id,
  'rotation',
  unixepoch()
FROM businesses
WHERE slug IN (
  'dalton-avenue-flowers-gifts',
  'strain-plumbing',
  'twisted-custom-leather',
  'valliant-storage',
  'velvet-fringe',
  'srvcflo-web-marketing-design'
);
