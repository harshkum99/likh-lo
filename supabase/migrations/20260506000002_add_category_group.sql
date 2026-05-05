-- Add category_group to categories table
ALTER TABLE categories ADD COLUMN IF NOT EXISTS category_group TEXT DEFAULT 'Other';

-- Update existing default categories with groups
UPDATE categories SET category_group = 'Fuel' WHERE name IN ('Diesel');
UPDATE categories SET category_group = 'Labour' WHERE name IN ('Labour', 'Driver Commission', 'Dalal', 'Santhali', 'Labour Milai', 'Dalal Commission', 'Loader', 'Loading Dalal', 'Driver Food');
UPDATE categories SET category_group = 'Material' WHERE name IN ('Material', 'Tyre', 'Vehicle Fault', 'JCB');
UPDATE categories SET category_group = 'Other' WHERE category_group IS NULL OR category_group = 'Other';
-- Toll, Parking, Border, Chanda remain as 'Other' or can be specified
UPDATE categories SET category_group = 'Other' WHERE name IN ('Toll', 'Parking', 'Border', 'Chanda');
