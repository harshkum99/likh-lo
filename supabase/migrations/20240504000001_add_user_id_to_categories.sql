-- Add user_id to categories to allow custom user categories
ALTER TABLE categories ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Update RLS for categories
-- Everyone can see default categories, but users can only see/manage their own custom categories
DROP POLICY "Categories are viewable by everyone" ON categories;
CREATE POLICY "Everyone can view default categories" ON categories FOR SELECT USING (is_default = true);
CREATE POLICY "Users can manage their own categories" ON categories FOR ALL USING (auth.uid() = user_id);
