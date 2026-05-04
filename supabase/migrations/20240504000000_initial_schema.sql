-- Create enum for trip status
CREATE TYPE trip_status AS ENUM ('running', 'completed');

-- Create categories table
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create trips table
CREATE TABLE trips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE,
    commodity TEXT,
    route TEXT,
    sell_amount NUMERIC(15, 2) DEFAULT 0,
    status trip_status DEFAULT 'running',
    notes TEXT,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create expenses table
CREATE TABLE expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Categories are viewable by everyone" ON categories FOR SELECT USING (true);
CREATE POLICY "Users can manage their own trips" ON trips FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own expenses" ON expenses FOR ALL USING (auth.uid() = user_id);

-- Seed default categories
INSERT INTO categories (name, is_default, sort_order) VALUES
('Driver Commission', true, 1),
('Labour', true, 2),
('Dalal', true, 3),
('Chanda', true, 4),
('Santhali', true, 5),
('Diesel', true, 6),
('Material', true, 7),
('Parking', true, 8),
('Driver Food', true, 9),
('Border', true, 10),
('JCB', true, 11),
('Toll', true, 12),
('Labour Milai', true, 13),
('Dalal Commission', true, 14),
('Loader', true, 15),
('Loading Dalal', true, 16),
('Tyre', true, 17),
('Vehicle Fault', true, 18);

-- Views
CREATE VIEW category_breakdown AS
SELECT 
    e.user_id,
    c.name as category_name,
    SUM(e.amount) as total_amount,
    (SUM(e.amount) * 100.0 / SUM(SUM(e.amount)) OVER (PARTITION BY e.user_id)) as pct_of_expense
FROM expenses e
JOIN categories c ON e.category_id = c.id
GROUP BY e.user_id, c.name;

CREATE VIEW monthly_report AS
WITH monthly_expenses AS (
    SELECT 
        user_id,
        DATE_TRUNC('month', date) as month,
        SUM(amount) as total_expense
    FROM expenses
    GROUP BY user_id, DATE_TRUNC('month', date)
),
monthly_trips AS (
    SELECT 
        user_id,
        DATE_TRUNC('month', start_date) as month,
        COUNT(id) as trip_count,
        SUM(sell_amount) as total_revenue
    FROM trips
    GROUP BY user_id, DATE_TRUNC('month', start_date)
)
SELECT 
    t.user_id,
    t.month,
    t.trip_count,
    t.total_revenue,
    COALESCE(e.total_expense, 0) as total_expense,
    (t.total_revenue - COALESCE(e.total_expense, 0)) as profit
FROM monthly_trips t
LEFT JOIN monthly_expenses e ON t.user_id = e.user_id AND t.month = e.month;

