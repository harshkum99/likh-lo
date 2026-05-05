-- Create dashboard_notes table
CREATE TABLE dashboard_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content TEXT DEFAULT '',
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE dashboard_notes ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage their own dashboard notes" 
ON dashboard_notes FOR ALL 
USING (auth.uid() = user_id);

-- Function to handle updated_at
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
CREATE TRIGGER set_dashboard_notes_updated_at
BEFORE UPDATE ON dashboard_notes
FOR EACH ROW
EXECUTE FUNCTION handle_updated_at();
