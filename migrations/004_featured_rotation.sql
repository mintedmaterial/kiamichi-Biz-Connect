-- Featured Rotation System
-- Migration 004: Add tables for automated featured business rotation
-- Created: 2025-02-09 by DevFlo

-- Track featured rotation history (audit log)
CREATE TABLE IF NOT EXISTS featured_rotation_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL,
    featured_start INTEGER NOT NULL,  -- Unix timestamp when featured
    featured_end INTEGER,              -- Unix timestamp when unfeatured (NULL = currently featured)
    rotation_reason TEXT,              -- 'scheduled', 'manual', 'ad_placement'
    slot_position INTEGER,             -- Which slot they were in (1-6)
    created_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

-- Featured slots configuration (6 slots by default)
CREATE TABLE IF NOT EXISTS featured_slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slot_position INTEGER NOT NULL UNIQUE,  -- 1, 2, 3, 4, 5, 6
    business_id INTEGER,                     -- Current business in slot (NULL = empty)
    priority_source TEXT DEFAULT 'rotation', -- 'rotation', 'ad', 'manual'
    rotation_interval_days INTEGER DEFAULT 7,
    last_rotated INTEGER,                    -- Unix timestamp of last rotation
    created_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE SET NULL
);

-- Initialize 6 featured slots (display slots on homepage)
INSERT OR IGNORE INTO featured_slots (slot_position, priority_source) VALUES 
    (1, 'rotation'),
    (2, 'rotation'),
    (3, 'rotation'),
    (4, 'rotation'),
    (5, 'rotation'),
    (6, 'rotation');

-- Featured tier table: businesses eligible for featured rotation (future paid tier)
-- For now, seeded with business IDs 1-20
CREATE TABLE IF NOT EXISTS featured_tier_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL UNIQUE,
    tier_level TEXT DEFAULT 'free',          -- 'free', 'basic', 'premium'
    tier_start INTEGER DEFAULT (unixepoch()),
    tier_end INTEGER,                         -- NULL = active, timestamp = expired
    notes TEXT,
    created_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

-- Seed with Minte's chosen 20 featured businesses
INSERT OR IGNORE INTO featured_tier_members (business_id, tier_level, notes) VALUES 
    (30, 'free', 'Minte selected featured pool'),
    (10, 'free', 'Minte selected featured pool'),
    (4, 'free', 'Minte selected featured pool'),
    (3, 'free', 'Minte selected featured pool'),
    (1, 'free', 'Minte selected featured pool'),
    (373, 'free', 'Minte selected featured pool'),
    (17, 'free', 'Minte selected featured pool'),
    (377, 'free', 'Minte selected featured pool'),
    (8, 'free', 'Minte selected featured pool'),
    (103, 'free', 'Minte selected featured pool'),
    (294, 'free', 'Minte selected featured pool'),
    (375, 'free', 'Minte selected featured pool'),
    (9, 'free', 'Minte selected featured pool'),
    (32, 'free', 'Minte selected featured pool'),
    (104, 'free', 'Minte selected featured pool'),
    (2, 'free', 'Minte selected featured pool'),
    (108, 'free', 'Minte selected featured pool'),
    (176, 'free', 'Minte selected featured pool'),
    (11, 'free', 'Minte selected featured pool'),
    (96, 'free', 'Minte selected featured pool');

CREATE INDEX IF NOT EXISTS idx_featured_tier_business ON featured_tier_members(business_id);
CREATE INDEX IF NOT EXISTS idx_featured_tier_active ON featured_tier_members(tier_end);

-- Set initial featured flag on Minte's top 6
UPDATE businesses SET is_featured = 1 WHERE id IN (30, 10, 4, 3, 1, 373);

-- Populate slots with first 6 from Minte's list
INSERT OR REPLACE INTO featured_slots (slot_position, business_id, priority_source, last_rotated) VALUES
    (1, 30, 'rotation', unixepoch()),
    (2, 10, 'rotation', unixepoch()),
    (3, 4, 'rotation', unixepoch()),
    (4, 3, 'rotation', unixepoch()),
    (5, 1, 'rotation', unixepoch()),
    (6, 373, 'rotation', unixepoch());

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_featured_rotation_business ON featured_rotation_log(business_id);
CREATE INDEX IF NOT EXISTS idx_featured_rotation_active ON featured_rotation_log(featured_end);
CREATE INDEX IF NOT EXISTS idx_featured_rotation_dates ON featured_rotation_log(featured_start, featured_end);
CREATE INDEX IF NOT EXISTS idx_featured_slots_business ON featured_slots(business_id);
