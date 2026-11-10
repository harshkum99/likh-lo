-- Register scan + driver ledger.
-- The paper register ticks items the driver paid from his own pocket ("Driver Kharcha")
-- and records cash handed to the driver ("Driver Jama"); the difference is what is owed ("Driver Nikla").

ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS paid_by TEXT NOT NULL DEFAULT 'owner'
  CHECK (paid_by IN ('owner', 'driver'));

ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS driver_advance NUMERIC(15, 2) NOT NULL DEFAULT 0;

-- Dashboard / trip pages filter expenses by user+date and by trip.
CREATE INDEX IF NOT EXISTS expenses_user_date_idx ON expenses (user_id, date);
CREATE INDEX IF NOT EXISTS expenses_trip_id_idx ON expenses (trip_id);
CREATE INDEX IF NOT EXISTS trips_user_start_idx ON trips (user_id, start_date);
