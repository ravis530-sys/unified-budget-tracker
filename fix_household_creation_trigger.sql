-- Create a trigger to automatically add the creator as an admin when a household is created
-- This ensures the creator is immediately added to household_members

CREATE OR REPLACE FUNCTION add_creator_to_household()
RETURNS TRIGGER AS $$
BEGIN
    -- Add the creator as an admin member
    INSERT INTO household_members (household_id, user_id, role)
    VALUES (NEW.id, NEW.created_by, 'admin');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop the trigger if it exists
DROP TRIGGER IF EXISTS on_household_created ON households;

-- Create the trigger
CREATE TRIGGER on_household_created
    AFTER INSERT ON households
    FOR EACH ROW
    EXECUTE FUNCTION add_creator_to_household();
