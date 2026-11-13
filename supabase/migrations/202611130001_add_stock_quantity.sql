-- Add stock_quantity column to products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS stock_quantity INTEGER NOT NULL DEFAULT 0;

-- Add comment
COMMENT ON COLUMN products.stock_quantity IS 'Quantidade em estoque do produto';
