-- Add vehicle_number to trips table
ALTER TABLE trips ADD COLUMN IF NOT EXISTS vehicle_number TEXT;
